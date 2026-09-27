import { createHash } from "node:crypto";

import { DbIterations } from "@/api-server/db-iterations";
import { DbSettings } from "@/api-server/db-settings";
import { HiveClient } from "@/api-server/hive/client";
import { createHiveServiceClient } from "@/api-server/hive/service-client";
import {
    escapeIcsText,
    icsDateTime,
    serializeIcsLines,
} from "@/api-server/ics";
import {
    DatabaseController,
    getDatabaseController,
} from "@/api-server/mongo-db-controller";
import { CourseId } from "@/api-shared/types/course";
import { DbEventDocument, eventTypeToHebrew } from "@/api-shared/types/event";
import { HiveLessonId } from "@/api-shared/types/hive";
import { RoomSource } from "@/api-shared/types/room";
import { HiveLessonDriver } from "@/api-shared/types/settings/hive-integration";

/*
 * The Bluz schedule as a calendar Hive can load in "external" schedule mode.
 *
 * Hive (`HIVE_SCHEDULE_MODE=external`) re-reads `/mnt/calendars/Calendar.ics`
 * every 35s and diffs it into its Event table by UID. It pulls meaning out of
 * plain ICS fields, so this feed writes them the way its loader
 * (`core/schedule/utils.parse_ical_events` + `ics.ICSImporter`) reads them:
 *
 * - SUMMARY  `{category} - {subject} - {lesson}` for a Hive event category
 *            with `has_lesson`, else `{category} - {title}`. Split on the
 *            first " - ", so no part but the last may contain one.
 * - LOCATION the Hive room's name. An unknown name makes Hive *create* a
 *            room, so custom Bluz rooms are never written.
 * - ATTENDEE `mailto:` the student group's Hive email — how Hive knows
 *            which classes attend. Groups without an email are skipped.
 * - UID      stable per Bluz event, so moves update instead of re-creating.
 *
 * Hive deletes any ICS-owned event missing from the file, so the feed always
 * carries the whole window Hive parses (now ± 100 days), never a page of it.
 */

/** Hive's own parse window (`convert_events_to_ical`), plus a day of slack. */
const HIVE_WINDOW_DAYS = 101;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Hive's title separator; see the module comment. */
const SEPARATOR = " - ";

/** Hive event category (with `has_lesson`) that subject-bound events use. */
export const DEFAULT_LESSON_CATEGORY = "שיעור";

/** Hive names the feed resolves Bluz ids against. */
export type HiveFeedLookup = {
    subjectName: (subjectId: number) => string | undefined;
    lesson: (
        lessonId: HiveLessonId,
    ) => { name: string; subjectName: string } | undefined;
    roomName: (roomId: number) => string | undefined;
    groupEmail: (courseId: CourseId) => string | undefined;
};

export type HiveFeedOptions = {
    /** Hive category for events bound to a subject. */
    lessonCategory: string;
};

// A " - " inside a non-final part would shift Hive's split; an en dash reads
// the same to people and is inert to the parser.
function summaryPart(text: string): string {
    return text.replaceAll(SEPARATOR, " – ").trim();
}

function buildSummary(
    event: DbEventDocument,
    lookup: HiveFeedLookup,
    options: HiveFeedOptions,
): string {
    const lesson = event.hiveLesson
        ? lookup.lesson(event.hiveLesson)
        : undefined;
    const subjectName =
        lesson?.subjectName ??
        (event.subject ? lookup.subjectName(event.subject) : undefined);

    if (!event.fake && subjectName) {
        // Hive falls back to the last part as the title when no lesson by
        // that name exists, so the event name is the useful fallback.
        return [
            summaryPart(options.lessonCategory),
            summaryPart(subjectName),
            lesson?.name ?? event.name,
        ].join(SEPARATOR);
    }

    return [summaryPart(eventTypeToHebrew(event.type)), event.name]
        .filter(Boolean)
        .join(SEPARATOR);
}

/**
 * Renders events as Hive-loadable ICS. Pure: same input, same bytes, which
 * is what lets the route answer `If-None-Match` with a 304.
 *
 * @param events Events to publish (hidden/archived are dropped here).
 * @param lookup Hive name resolution for subjects, lessons, rooms, groups.
 * @param options Category naming.
 * @returns The calendar text.
 */
export function buildHiveScheduleIcs(
    events: Array<DbEventDocument>,
    lookup: HiveFeedLookup,
    options: HiveFeedOptions,
): string {
    const lines: Array<string> = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Bluz//Hive Schedule Feed//HE",
        "CALSCALE:GREGORIAN",
    ];

    const published = events
        .filter((event) => !event.archived && !event.hidden)
        .sort(
            (a, b) =>
                new Date(a.startTime).getTime() -
                    new Date(b.startTime).getTime() || a.id.localeCompare(b.id),
        );

    for (const event of published) {
        // DTSTAMP from the event's own revision, not the clock, keeps the
        // body byte-stable between polls.
        const stamp = new Date(event.updatedAt ?? event.startTime);

        lines.push(
            "BEGIN:VEVENT",
            `UID:${event.id}@bluz-schedule`,
            `DTSTAMP:${icsDateTime(stamp)}`,
            `DTSTART:${icsDateTime(event.startTime)}`,
            `DTEND:${icsDateTime(event.endTime)}`,
            `SUMMARY:${escapeIcsText(buildSummary(event, lookup, options))}`,
        );

        // Hive stores one room per event; the first Hive room wins.
        const room = event.rooms
            ?.filter((r) => r.source === RoomSource.Hive)
            .map((r) => lookup.roomName(r.id as number))
            .find(Boolean);
        if (room) lines.push(`LOCATION:${escapeIcsText(room)}`);

        const emails = new Set(
            (event.courses ?? [])
                .map((courseId) => lookup.groupEmail(courseId))
                .filter((email): email is string => Boolean(email)),
        );
        for (const email of emails) lines.push(`ATTENDEE:mailto:${email}`);

        if (event.notes?.trim()) {
            lines.push(`DESCRIPTION:${escapeIcsText(event.notes.trim())}`);
        }
        lines.push("END:VEVENT");
    }

    lines.push("END:VCALENDAR");
    return serializeIcsLines(lines);
}

/** Resolves every Hive name the given events reference, in parallel. */
async function loadHiveLookup(
    hive: HiveClient,
    db: DatabaseController,
    events: Array<DbEventDocument>,
): Promise<HiveFeedLookup> {
    const moduleIds = [
        ...new Set(
            events
                .filter((e) => e.hiveLesson && e.hiveModule)
                .map((e) => e.hiveModule),
        ),
    ];

    const [subjects, rooms, groups, courses, lessonsByModule] =
        await Promise.all([
            hive.getSubjects(),
            hive.getRooms(),
            hive.getClasses(),
            db.courses.find({}).toArray(),
            Promise.all(
                moduleIds.map((id) => hive.getLessons({ module__id: id })),
            ),
        ]);

    const subjectNames = new Map(subjects.map((s) => [s.id, s.name]));
    const roomNames = new Map(rooms.map((r) => [r.id, r.name]));
    // A Bluz course is a shuffle, 1:1 with a Hive student group by name.
    const emailByGroupName = new Map(
        groups.filter((g) => g.email).map((g) => [g.name, g.email!]),
    );
    const emailByCourse = new Map(
        courses.map((c) => [c.id, emailByGroupName.get(c.name)]),
    );
    const lessons = new Map(
        lessonsByModule
            .flat()
            .map((l) => [
                String(l.id),
                { name: l.name, subjectName: l.subject_name },
            ]),
    );

    return {
        groupEmail: (courseId) => emailByCourse.get(courseId),
        lesson: (lessonId) => lessons.get(String(lessonId)),
        roomName: (roomId) => roomNames.get(roomId),
        subjectName: (subjectId) => subjectNames.get(subjectId),
    };
}

export type HiveScheduleFeed = { body: string; etag: string };

const EMPTY_LOOKUP: HiveFeedLookup = {
    groupEmail: () => undefined,
    lesson: () => undefined,
    roomName: () => undefined,
    subjectName: () => undefined,
};

function withEtag(body: string): HiveScheduleFeed {
    const etag = `"${createHash("sha256").update(body).digest("base64url")}"`;
    return { body, etag };
}

/**
 * The current iteration's schedule as a Hive feed, resolved with the Bluz
 * service account (the feed is fetched by a machine, never a browser).
 *
 * @param now Centre of the published window (injectable for tests).
 * @returns The calendar and its strong ETag, or null with no iteration yet.
 */
export async function loadHiveScheduleFeed(
    now: Date = new Date(),
): Promise<HiveScheduleFeed | null> {
    const iteration = await DbIterations.currentOrNull();
    if (!iteration) return null;
    const db = getDatabaseController(iteration.dbName);

    // Feed switched off: publish an empty calendar rather than an error, so
    // Hive's diff drops every Bluz event it loaded and its own lesson
    // assignment stops, leaving the activator as the only driver.
    if ((await DbSettings.hiveLessonDriver(db)) !== HiveLessonDriver.ICS_FEED) {
        return withEtag(
            buildHiveScheduleIcs([], EMPTY_LOOKUP, { lessonCategory: "" }),
        );
    }

    const events = await db.events
        .find({
            archived: { $ne: true },
            endTime: {
                $gt: new Date(now.getTime() - HIVE_WINDOW_DAYS * DAY_MS),
            },
            hidden: { $ne: true },
            startTime: {
                $lt: new Date(now.getTime() + HIVE_WINDOW_DAYS * DAY_MS),
            },
        })
        .toArray();

    const lookup = await loadHiveLookup(
        await createHiveServiceClient(),
        db,
        events,
    );
    const body = buildHiveScheduleIcs(events, lookup, {
        lessonCategory:
            process.env.HIVE_FEED_LESSON_CATEGORY || DEFAULT_LESSON_CATEGORY,
    });
    return withEtag(body);
}
