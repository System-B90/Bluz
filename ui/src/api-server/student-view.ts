import { getServerSession } from "next-auth";

import { DbCourses } from "@/api-server/db-courses";
import { DbCustomColors } from "@/api-server/db-custom-colors";
import { DbEvent, DbEventDocument } from "@/api-server/db-event";
import { createHiveServiceClient } from "@/api-server/hive/service-client";
import { authOptions } from "@/api-server/hive/sso";
import { DatabaseController } from "@/api-server/mongo-db-controller";
import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import { ForbiddenError, UserNotLoggedInError } from "@/api-shared/errors";
import { Clearance } from "@/api-shared/types/hive";
import { RoomSource } from "@/api-shared/types/room";
import { AuthSessionData } from "@/api-shared/types/sso";
import {
    ApiStudentScheduleGetResponse,
    StudentEvent,
} from "@/api-shared/types/student-view";
import { Subject } from "@/api-shared/types/subject";

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
 * below Hanich (i.e. no session at all) is rejected.
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
async function getSubjectColors(): Promise<Map<string, string>> {
    try {
        const hive = await createHiveServiceClient();
        const subjects: Array<Subject> = await hive.getSubjects();
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
): Promise<Map<string, string>> {
    const names = new Map<string, string>();
    const customRooms = await controller.rooms.find({}).toArray();
    for (const room of customRooms) {
        names.set(`${RoomSource.Custom}:${room.id}`, room.name);
    }
    try {
        const hive = await createHiveServiceClient();
        for (const room of await hive.getRooms()) {
            names.set(
                `${RoomSource.Hive}:${room.id}`,
                room.display_name || room.name,
            );
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

    const events = await DbEvent.getInRange(
        dayStart.toDate(),
        dayEnd.toDate(),
        undefined,
        { hidden: { $ne: true } },
        controller,
    );

    const [customColorDocs, courses, roomNames] = await Promise.all([
        DbCustomColors.get(),
        DbCourses.get(undefined, controller),
        getRoomNames(controller),
    ]);
    const customColors = new Map(customColorDocs.map((c) => [c.id, c.hex]));
    const courseNames = new Map(courses.map((c) => [c.id, c.name]));
    const subjectColors = await getSubjectColors();

    const projected: Array<StudentEvent> = events.map((event) => ({
        id: event.id,
        name: event.name,
        startTime: new Date(event.startTime).toISOString(),
        endTime: new Date(event.endTime).toISOString(),
        color: resolveColorHex(event, customColors, subjectColors),
        rooms: (event.rooms ?? [])
            .map((room) => roomNames.get(`${room.source}:${room.id}`))
            .filter((name): name is string => Boolean(name)),
        courses: (event.courses ?? [])
            .map((courseId) => courseNames.get(courseId))
            .filter((name): name is string => Boolean(name)),
    }));

    projected.sort((a, b) => a.startTime.localeCompare(b.startTime));

    return { date, events: projected };
}
