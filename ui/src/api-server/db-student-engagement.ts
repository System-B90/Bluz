import {
    getMetaController,
    StudentEngagementDocument,
} from "@/api-server/mongo-db-controller";

/**
 * Largest increment a single report may carry, in seconds. The client flushes
 * on a fixed heartbeat, so anything much larger than one interval is either a
 * clock jump or a forged report — clamped rather than rejected so an honest
 * client with a stalled tab still records something plausible.
 */
export const MAX_ENGAGEMENT_REPORT_SECONDS = 120;

/** A day cannot contain more than this, whatever the client claims. */
const MAX_SECONDS_PER_DAY = 24 * 60 * 60;

/**
 * Adds focused-time to a student's counter for one day (#656).
 *
 * The caller's identity comes from the session, never from the request body —
 * a student must not be able to write to another student's counter. The
 * increment is clamped on the way in and the running total is capped, so a
 * scripted client can inflate its own number only up to a day's length.
 *
 * @param userId Session-derived user id.
 * @param date `yyyy-MM-dd` in the app timezone.
 * @param seconds Reported focused seconds since the last report.
 * @returns The seconds actually recorded.
 */
export async function addStudentEngagementSeconds(
    userId: string,
    date: string,
    seconds: number,
): Promise<number> {
    if (!Number.isFinite(seconds) || seconds <= 0) return 0;

    const delta = Math.min(Math.floor(seconds), MAX_ENGAGEMENT_REPORT_SECONDS);
    const id = `${userId}:${date}`;

    const result = await getMetaController().studentEngagement.findOneAndUpdate(
        { id },
        {
            $inc: { seconds: delta },
            $set: { updatedAt: new Date() },
            $setOnInsert: { date, userId },
        },
        { returnDocument: "after", upsert: true },
    );

    // Cap after the fact rather than reading first: the `$inc` stays a single
    // atomic op under concurrent tabs, and a clamp only ever runs on the one
    // report that crosses the ceiling.
    const total = result?.seconds ?? delta;
    if (total > MAX_SECONDS_PER_DAY) {
        await getMetaController().studentEngagement.updateOne(
            { id },
            { $set: { seconds: MAX_SECONDS_PER_DAY } },
        );
        return 0;
    }

    return delta;
}

/** Reads one student's counter for a day. Staff-only callers. */
export async function getStudentEngagement(
    userId: string,
    date: string,
): Promise<null | StudentEngagementDocument> {
    return await getMetaController().studentEngagement.findOne({
        id: `${userId}:${date}`,
    });
}
