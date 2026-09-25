import { getServerSession } from "next-auth";

import { DbCourses } from "@/api-server/db-courses";
import { DbCustomColors } from "@/api-server/db-custom-colors";
import { DbEvent, DbEventDocument } from "@/api-server/db-event";
import { DbSettings } from "@/api-server/db-settings";
import { HiveClient } from "@/api-server/hive/client";
import { createHiveServiceClient } from "@/api-server/hive/service-client";
import { authOptions } from "@/api-server/hive/sso";
import { DatabaseController } from "@/api-server/mongo-db-controller";
import { relatedCoursesResolver } from "@/api-shared/course-tree";
import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import { ForbiddenError, UserNotLoggedInError } from "@/api-shared/errors";
import { Clearance } from "@/api-shared/types/hive";
import { RoomSource } from "@/api-shared/types/room";
import {
    DEFAULT_CALENDAR_DAY_END_TIME,
    DEFAULT_CALENDAR_DAY_START_TIME,
    SCHEDULE_SETTINGS_KEY,
    ScheduleSettings,
} from "@/api-shared/types/settings/schedule";
import { AuthSessionData } from "@/api-shared/types/sso";
import {
    ApiStudentScheduleGetResponse,
    StudentEventWire,
} from "@/api-shared/types/student-view";

/** Colour used when nothing resolves — matches the calendar's own fallback. */
const FALLBACK_COLOR = "#000000";
/** Prayer default, mirroring `components/schedule/event-component/event-colors`. */
const PRAYER_DEFAULT_COLOR = "#e0f9fe";
const PRAYER_EVENT_TYPE = "תפילה";

const DATE_FORMAT = "YYYY-MM-DD";

export type StudentViewSession = {
    clearance: Clearance;
    /** Staff (Segel/Admin) get the preview affordances; students never do. */
    isStaff: boolean;
    /** Session-derived user id. Never taken from a request body. */
    userId: string;
};

/**
 * Gates the student-view endpoint. Unlike every other API route this one is
 * reachable by a Hanich session — it is the single endpoint that is. Anything
 * below Hanich (i.e. no session at all) is rejected: every student reaches
 * Bluz through a Hive sign-in, so there is no anonymous viewer to serve.
 */
export async function requireStudentViewSession(): Promise<StudentViewSession> {
    const session = (await getServerSession(authOptions)) as
        | AuthSessionData
        | null;
    if (!session?.user) {
        throw new UserNotLoggedInError("Unauthorized: No active session found.");
    }
    const { clearance } = session.user;
    const isStaff =
        clearance === Clearance.Segel || clearance === Clearance.Admin;
    if (!isStaff && clearance !== Clearance.Hanich) {
        throw new ForbiddenError("Forbidden: insufficient clearance.");
    }
    return { clearance, isStaff, userId: session.user.id };
}

/** The server's current day in the app timezone, `yyyy-MM-dd`. */
export function currentAppDate(): string {
    return dayjs().tz(APP_TIMEZONE).format(DATE_FORMAT);
}

/**
 * Resolves which day to serve. Students always get the *server's* current day
 * in the app timezone; a client-supplied date is not merely ignored for them
 * but rejected, so a probe for another day is a hard error rather than a
 * silently-succeeding request. Staff may pass one to preview another day.
 */
export function resolveStudentViewDate(
    rawDate: null | string,
    isStaff: boolean,
): string {
    if (!rawDate) return currentAppDate();
    if (!isStaff) {
        throw new ForbiddenError("Forbidden: date selection is staff-only.");
    }
    const parsed = dayjs.tz(rawDate, DATE_FORMAT, APP_TIMEZONE);
    if (!parsed.isValid()) {
        throw new ForbiddenError("Forbidden: invalid date.");
    }
    return parsed.format(DATE_FORMAT);
}

/**
 * Subject colours, keyed by subject id, resolved with the Bluz *service*
 * account rather than the caller's token: a student must not be able to reach
 * Hive through Bluz, and the only thing derived from the lookup is a hex
 * string, which never identifies the subject. Hive being unavailable degrades
 * to the fallback colour instead of failing the request.
 */
async function getSubjectColors(
    hive: Promise<HiveClient>,
): Promise<Map<string, string>> {
    try {
        const subjects = await (await hive).getSubjects();
        return new Map(
            subjects
                .filter((subject) => Boolean(subject.color))
                .map((subject) => [String(subject.id), subject.color as string]),
        );
    } catch {
        return new Map();
    }
}

/**
 * Server-side mirror of `resolveEventColor`, collapsed to a hex string.
 * `event.color` stores an *id* (custom colour or Hive subject), so returning it
 * verbatim would hand a student a Hive subject id — the whole reason this
 * resolution happens here and not in the browser.
 */
function resolveColorHex(
    event: Pick<DbEventDocument, "color" | "subject" | "type">,
    customColors: Map<string, string>,
    subjectColors: Map<string, string>,
): string {
    if (event.color) {
        const custom = customColors.get(event.color);
        if (custom) return custom;
        const bySubject = subjectColors.get(event.color);
        if (bySubject) return bySubject;
    }
    if (event.type === PRAYER_EVENT_TYPE) return PRAYER_DEFAULT_COLOR;
    return subjectColors.get(String(event.subject)) ?? FALLBACK_COLOR;
}

/** Room id → display name, for both Hive and custom rooms. */
async function getRoomNames(
    controller: DatabaseController,
    hive: Promise<HiveClient>,
): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    const customRooms = await controller.rooms.find({}).toArray();
    for (const room of customRooms) {
        names.set(`${RoomSource.Custom}:${room.id}`, room.name);
    }
    try {
        for (const room of await (await hive).getRooms()) {
            // `display_name` is the room's full path ("רמת גן / Bis90 / Room");
            // the calendar's own column headers use the short `name`.
            names.set(`${RoomSource.Hive}:${room.id}`, room.name || room.display_name);
        }
    } catch {
        // Hive down: custom rooms still render, Hive rooms are simply omitted.
    }
    return names;
}

/**
 * Builds the student projection of a single day's schedule.
 *
 * Two exclusions are enforced in the Mongo query itself rather than in the
 * mapper below, so no future refactor of the mapping can leak them: hidden
 * events (`hidden: true`) and anything outside the requested day. Archived
 * events are excluded by `DbEvent.getInRange` itself.
 */
export async function buildStudentSchedule(
    date: string,
    controller: DatabaseController,
): Promise<ApiStudentScheduleGetResponse> {
    const dayStart = dayjs.tz(date, DATE_FORMAT, APP_TIMEZONE).startOf("day");
    const dayEnd = dayStart.add(1, "day");

    // One service-client login shared by both Hive lookups; each still
    // degrades on its own when Hive is down.
    const hive = createHiveServiceClient();
    hive.catch(() => undefined);

    const [
        events,
        customColorDocs,
        courses,
        roomNameById,
        subjectColors,
        scheduleSetting,
    ] = await Promise.all([
        DbEvent.getInRange(
            dayStart.toDate(),
            dayEnd.toDate(),
            undefined,
            { hidden: { $ne: true } },
            controller,
        ),
        DbCustomColors.get(),
        DbCourses.get(undefined, controller),
        getRoomNames(controller, hive),
        getSubjectColors(hive),
        DbSettings.get(SCHEDULE_SETTINGS_KEY, undefined, controller) as
            Promise<null | ScheduleSettings>,
    ]);
    const customColors = new Map(customColorDocs.map((c) => [c.id, c.hex]));
    const courseNameById = new Map(courses.map((c) => [c.id, c.name]));
    const resolveRelated = relatedCoursesResolver(courses);

    const roomNames = new Interner<string>();
    const courseNames = new Interner<string>();
    const courseGroups = new Interner<string, Array<number>>();
    /** Course ids → group index. Unknown ids are dropped, order is kept. */
    const groupOf = (courseIds: Iterable<string>): number => {
        const indices: Array<number> = [];
        for (const id of courseIds) {
            const name = courseNameById.get(id);
            if (name) indices.push(courseNames.add(name));
        }
        return courseGroups.add(indices.join(","), indices);
    };

    const projected: Array<StudentEventWire> = events
        .map((event) => {
            const courseIds = event.courses ?? [];
            return {
                id: event.id,
                name: event.name,
                startTime: new Date(event.startTime).toISOString(),
                endTime: new Date(event.endTime).toISOString(),
                color: resolveColorHex(event, customColors, subjectColors),
                rooms: (event.rooms ?? []).flatMap((room) => {
                    const name = roomNameById.get(`${room.source}:${room.id}`);
                    return name ? [roomNames.add(name)] : [];
                }),
                courses: groupOf(courseIds),
                relatedCourses: groupOf(resolveRelated(courseIds)),
            };
        })
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

    return {
        calendarDayEndTime:
            scheduleSetting?.calendarDayEndTime ?? DEFAULT_CALENDAR_DAY_END_TIME,
        calendarDayStartTime:
            scheduleSetting?.calendarDayStartTime ??
            DEFAULT_CALENDAR_DAY_START_TIME,
        courseGroups: courseGroups.values,
        courseNames: courseNames.values,
        date,
        events: projected,
        roomNames: roomNames.values,
    };
}

/** Assigns each distinct key a stable position in `values`. */
class Interner<K, V = K> {
    readonly values: Array<V> = [];
    private readonly indexByKey = new Map<K, number>();

    add(key: K, value: V = key as unknown as V): number {
        let index = this.indexByKey.get(key);
        if (index === undefined) {
            index = this.values.push(value) - 1;
            this.indexByKey.set(key, index);
        }
        return index;
    }
}
