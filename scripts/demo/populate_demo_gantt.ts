/**
 * Seeds the Gantt (Postgres) side of the demo data.
 *
 * The Mongo seed only ever filled the schedule — courses and calendar events —
 * so every curriculum-shaped e2e assertion had nothing to look at and skipped
 * itself ("no curriculums seeded", "no syllabuses seeded", "need a second
 * curriculum to share into"). This builds the smallest tree that makes those
 * features real:
 *
 *   מחזור א׳ ─┬─ סילבוס משותף ── מערך פתיחה ─┬─ הרצאת פתיחה   (mapped, week 1)
 *             │                              └─ תרגול פתיחה   (mapped, week 1)
 *             └─ סילבוס מחזור א׳ ── מערך ליבה ── הרצאת ליבה   (mapped, week 2)
 *   מחזור ב׳ ─── סילבוס משותף (the same syllabus — shared across curriculums)
 *
 * The shared syllabus is the point of the second curriculum: `curriculumIds`
 * is a list precisely because a syllabus can hang off several curriculums
 * (#310), and nothing exercised that with more than one parent.
 *
 * Raw SQL rather than Drizzle: this runs as a standalone `tsx` script outside
 * Next, where the schema modules' `@/` imports do not resolve.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

import postgres from "postgres";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootEnvPath = path.resolve(__dirname, "../../.env");
if (fs.existsSync(rootEnvPath)) {
    process.loadEnvFile(rootEnvPath);
}

/**
 * `DATABASE_URL` in `.env` names the compose service (`bluz-curriculum-db`),
 * which only resolves inside that network. `run_tests.py` overrides it with a
 * published endpoint; a bare `npm run db:seed` on the host gets the same
 * treatment here via TEST_POSTGRES_PORT, mirroring the Mongo seed's handling.
 */
function resolveDatabaseUrl(): string {
    const raw =
        process.env.DATABASE_URL ??
        "postgres://admin:admin@127.0.0.1:5433/curriculum_db";
    const url = new URL(raw);
    if (url.hostname === "bluz-curriculum-db" || url.hostname === "curriculum-db") {
        url.hostname = process.env.POSTGRES_HOST || "127.0.0.3";
        url.port = process.env.TEST_POSTGRES_PORT || url.port || "5433";
    }
    return url.toString();
}

/** Ids are stable so a reseed replaces the same rows instead of piling up. */
const IDS = {
    curriculumA: "c_demo_main",
    curriculumB: "c_demo_second",
    sharedSyllabus: "s_demo_shared",
    ownSyllabus: "s_demo_main_only",
    openingModule: "m_demo_opening",
    coreModule: "m_demo_core",
    openingLecture: "e_demo_opening_lecture",
    openingExercise: "e_demo_opening_exercise",
    coreLecture: "e_demo_core_lecture",
} as const;

const WEEKDAY_MINUTES = 9 * 60;
const FRIDAY_MINUTES = 5 * 60;

/** Sunday of the week a fortnight out, so demo cuts land clear of today. */
function upcomingSunday(): string {
    const date = new Date();
    date.setDate(date.getDate() + 14 + ((7 - date.getDay()) % 7));
    return date.toISOString().slice(0, 10);
}

function dayMinutes(dayIndex: number): number {
    if (dayIndex === 6) return 0; // Shabbat
    if (dayIndex === 5) return FRIDAY_MINUTES;
    return WEEKDAY_MINUTES;
}

async function main(): Promise<void> {
    const databaseUrl = resolveDatabaseUrl();
    console.log(
        `Connecting to Postgres at: ${databaseUrl.replace(/:([^:@]+)@/, ":****@")}`,
    );
    const sql = postgres(databaseUrl, { max: 1, onnotice: () => {} });

    try {
        await sql.begin(async (tx) => {
            // Cascades clear the junctions, mappings and configurations that
            // hang off these rows, so a reseed is a clean replace.
            await tx`DELETE FROM c WHERE id IN (${IDS.curriculumA}, ${IDS.curriculumB})`;
            await tx`DELETE FROM s WHERE id IN (${IDS.sharedSyllabus}, ${IDS.ownSyllabus})`;
            await tx`DELETE FROM m WHERE id IN (${IDS.openingModule}, ${IDS.coreModule})`;
            await tx`DELETE FROM e WHERE id IN (${IDS.openingLecture}, ${IDS.openingExercise}, ${IDS.coreLecture})`;

            const startDate = upcomingSunday();
            await tx`
                INSERT INTO c (id, title, description, start_date, draft, archived)
                VALUES
                    (${IDS.curriculumA}, ${'מחזור הדגמה א׳'}, ${"גאנט הדגמה מלא"}, ${startDate}, false, false),
                    (${IDS.curriculumB}, ${'מחזור הדגמה ב׳'}, ${"גאנט הדגמה שני, חולק סילבוס עם הראשון"}, ${startDate}, true, false)
            `;

            await tx`
                INSERT INTO s (id, title, hive_ids, shuffles)
                VALUES
                    (${IDS.sharedSyllabus}, ${"סילבוס משותף"}, '{}', '{}'),
                    (${IDS.ownSyllabus}, ${'סילבוס מחזור א׳'}, '{}', '{}')
            `;

            // The shared syllabus hangs off both curriculums; the second one
            // is what makes `curriculumIds` a list worth asserting on.
            await tx`
                INSERT INTO c2s (curriculum_id, syllabus_id)
                VALUES
                    (${IDS.curriculumA}, ${IDS.sharedSyllabus}),
                    (${IDS.curriculumB}, ${IDS.sharedSyllabus}),
                    (${IDS.curriculumA}, ${IDS.ownSyllabus})
            `;

            await tx`
                INSERT INTO m (id, title, "desc", hive_ids, shuffles)
                VALUES
                    (${IDS.openingModule}, ${"מערך פתיחה"}, ${"מודול הדגמה"}, '{}', '{}'),
                    (${IDS.coreModule}, ${"מערך ליבה"}, ${"מודול הדגמה"}, '{}', '{}')
            `;
            await tx`
                INSERT INTO s2m (syllabus_id, module_id, sort_order)
                VALUES
                    (${IDS.sharedSyllabus}, ${IDS.openingModule}, 0),
                    (${IDS.ownSyllabus}, ${IDS.coreModule}, 0)
            `;

            await tx`
                INSERT INTO e (id, title, type, minimum_duration, room_requirement, recurrence)
                VALUES
                    (${IDS.openingLecture}, ${"הרצאת פתיחה"}, ${"הרצאה"}, 60, ${"בחדר מסווג"}, ${"none"}),
                    (${IDS.openingExercise}, ${"תרגול פתיחה"}, ${'ע"ע'}, 90, ${"בחדר מסווג"}, ${"none"}),
                    (${IDS.coreLecture}, ${"הרצאת ליבה"}, ${"הרצאה"}, 120, ${"בחדר מסווג"}, ${"weekly"})
            `;
            await tx`
                INSERT INTO m2e (module_id, event_id, sort_order)
                VALUES
                    (${IDS.openingModule}, ${IDS.openingLecture}, 0),
                    (${IDS.openingModule}, ${IDS.openingExercise}, 1),
                    (${IDS.coreModule}, ${IDS.coreLecture}, 0)
            `;

            // Durations are per curriculum, so the planner needs a row for the
            // curriculum the events are actually cut from.
            await tx`
                INSERT INTO "cEC" (curriculum_id, event_id, allocated_duration)
                VALUES
                    (${IDS.curriculumA}, ${IDS.openingLecture}, 60),
                    (${IDS.curriculumA}, ${IDS.openingExercise}, 90),
                    (${IDS.curriculumA}, ${IDS.coreLecture}, 120),
                    (${IDS.curriculumB}, ${IDS.openingLecture}, 60),
                    (${IDS.curriculumB}, ${IDS.openingExercise}, 90)
            `;

            // Two weeks per curriculum, each with its seven days — the same
            // shape `DbWeek.createNewItem` builds through the API.
            const dayIdsByWeek: Record<string, Array<string>> = {};
            for (const [curriculumId, prefix] of [
                [IDS.curriculumA, "a"],
                [IDS.curriculumB, "b"],
            ] as const) {
                for (let weekNumber = 1; weekNumber <= 2; weekNumber++) {
                    const weekId = `w_demo_${prefix}${weekNumber}`;
                    await tx`
                        INSERT INTO w (id, number, comment, weekend_duty)
                        VALUES (${weekId}, ${weekNumber}, '', false)
                    `;
                    await tx`
                        INSERT INTO c2w (c_id, w_id)
                        VALUES (${curriculumId}, ${weekId})
                    `;

                    const dayIds: Array<string> = [];
                    for (let dayIndex = 0; dayIndex <= 6; dayIndex++) {
                        const dayId = `d_demo_${prefix}${weekNumber}_${dayIndex}`;
                        await tx`
                            INSERT INTO d (id, day_index, total_working_min, comment)
                            VALUES (${dayId}, ${dayIndex}, ${dayMinutes(dayIndex)}, '')
                        `;
                        await tx`
                            INSERT INTO w2d (w_id, d_id)
                            VALUES (${weekId}, ${dayId})
                        `;
                        dayIds.push(dayId);
                    }
                    dayIdsByWeek[weekId] = dayIds;
                }
            }

            // Place the events on days of curriculum א׳, so its timeline and
            // cut preview show something rather than an all-unallocated grid.
            const weekOneSunday = dayIdsByWeek["w_demo_a1"][0];
            const weekOneMonday = dayIdsByWeek["w_demo_a1"][1];
            const weekTwoSunday = dayIdsByWeek["w_demo_a2"][0];
            await tx`
                INSERT INTO "cMDA" (id, curriculum_id, module_id, event_id, day_id, s)
                VALUES
                    (${"map_demo_1"}, ${IDS.curriculumA}, ${IDS.openingModule}, ${IDS.openingLecture}, ${weekOneSunday}, 0),
                    (${"map_demo_2"}, ${IDS.curriculumA}, ${IDS.openingModule}, ${IDS.openingExercise}, ${weekOneMonday}, 0),
                    (${"map_demo_3"}, ${IDS.curriculumA}, ${IDS.coreModule}, ${IDS.coreLecture}, ${weekTwoSunday}, 0)
            `;
        });

        const [{ count: curriculums }] = await sql`SELECT count(*) FROM c`;
        const [{ count: syllabuses }] = await sql`SELECT count(*) FROM s`;
        const [{ count: events }] = await sql`SELECT count(*) FROM e`;
        console.log(
            `Gantt seeding completed: ${curriculums} curriculums, ${syllabuses} syllabuses, ${events} events.`,
        );
    } finally {
        await sql.end({ timeout: 5 });
    }
}

main().catch((error: unknown) => {
    console.error("An error occurred during gantt seeding:", error);
    process.exit(1);
});
