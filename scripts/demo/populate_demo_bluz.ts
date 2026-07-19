import { MongoClient } from "mongodb";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { v4 as uuidv4 } from "uuid";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from root .env and parse connection string directly to bypass system overrides
const rootEnvPath = path.resolve(__dirname, "../../.env");
let localConnectionString = "";
if (fs.existsSync(rootEnvPath)) {
    try {
        process.loadEnvFile(rootEnvPath);
        console.log(`Loaded environment variables from ${rootEnvPath}`);

        // Parse .env manually to get the local MONGO_CONNECTION_STRING in case it's overridden in the system env
        const envContent = fs.readFileSync(rootEnvPath, "utf-8");
        for (const line of envContent.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith("#")) {
                const index = trimmed.indexOf("=");
                if (index !== -1) {
                    const key = trimmed.substring(0, index).trim();
                    let value = trimmed.substring(index + 1).trim();
                    // Remove quotes if present
                    if (
                        (value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))
                    ) {
                        value = value.substring(1, value.length - 1);
                    }
                    if (key === "MONGO_CONNECTION_STRING") {
                        localConnectionString = value;
                    }
                }
            }
        }
    } catch (e) {
        console.warn("Failed to load environment variables natively:", e);
    }
}

// Hebrew event types mapping
enum EventType {
    EXERCISE = 'ע"ע',
    LECTURE = "הרצאה",
    BREAK = "הפסקה",
    PRAYER = "תפילה",
    OTHER = "אחר",
}

async function main() {
    // 1. Read Hive metadata exported by python script
    const hiveDataPath = path.resolve(__dirname, "hive_data.json");
    if (!fs.existsSync(hiveDataPath)) {
        console.error(
            "Error: hive_data.json not found! You must run populate_demo_hive.py first.",
        );
        process.exit(1);
    }

    const hiveData = JSON.parse(fs.readFileSync(hiveDataPath, "utf-8"));
    const segelUsers = hiveData.segel || [];
    const adminUsers = hiveData.admins || [];
    const subjects = hiveData.subjects || [];
    const modules = hiveData.modules || [];
    const rooms = hiveData.rooms || [];

    if (segelUsers.length === 0) {
        console.error("Error: No segel users found in hive_data.json.");
        process.exit(1);
    }

    const findAdminId = (username: string): number | undefined =>
        adminUsers.find((u: any) => u.username === username)?.id;

    let connectionString =
        localConnectionString ||
        process.env.MONGO_CONNECTION_STRING ||
        "mongodb://127.0.0.1:27017/";

    // If running on host machine outside Docker, translate Docker service/remote hostnames to local port-mapping
    const isRunningInDocker =
        fs.existsSync("/.dockerenv") || process.env.IS_DOCKER === "true";
    if (!isRunningInDocker) {
        const mongoPort = process.env.MONGO_PORT || "27018";
        console.log(
            `Running on host machine. Translating MongoDB connection to local port-mapping (172.27.80.1:${mongoPort})...`
        );
        connectionString = connectionString.replace(
            /@([^/:]+)(:\d+)?/,
            `@172.27.80.1:${mongoPort}`
        );
    }

    console.log(
        `Connecting to MongoDB at: ${connectionString.replace(/:([^:@]+)@/, ":****@")}`,
    );

    const client = new MongoClient(connectionString);
    try {
        await client.connect();
        const db = client.db("bluz");
        console.log("Successfully connected to database: bluz");

        // 3. Clear existing collections
        console.log("Clearing courses and events collections...");
        await db.collection("courses").deleteMany({});
        await db.collection("events").deleteMany({});

        // 4. Create courses (1 main course and 3 sub-courses)
        const segelIds = segelUsers.map((u: any) => u.id);
        const getRandomSegel = (count: number): number[] => {
            const shuffled = [...segelIds].sort(() => 0.5 - Math.random());
            return shuffled.slice(0, Math.min(count, shuffled.length));
        };

        const gassiId = findAdminId("gassi");
        const mainCourse = {
            id: "bis-90",
            name: 'בי"ס 90',
            color: "#4f46e5",
            parentId: null,
            instructorIds: gassiId !== undefined ? [gassiId] : [],
        };

        const michaelksId = findAdminId("michaelks");
        const subCourseApollo = {
            id: "bis-90-apollo",
            name: "אפולו",
            color: "#06b6d4",
            parentId: "bis-90",
            instructorIds: michaelksId !== undefined ? [michaelksId] : [],
        };

        const omerbId = findAdminId("omerb");
        const subCourseMivtzar = {
            id: "bis-90-mivtzar",
            name: "מבצר",
            color: "#10b981",
            parentId: "bis-90",
            instructorIds: omerbId !== undefined ? [omerbId] : [],
        };

        const yardendId = findAdminId("yardend");
        const subCourseSphinx = {
            id: "bis-90-sphinx",
            name: "ספינקס",
            color: "#f59e0b",
            parentId: "bis-90",
            instructorIds: yardendId !== undefined ? [yardendId] : [],
        };

        const coursesList = [
            mainCourse,
            subCourseApollo,
            subCourseMivtzar,
            subCourseSphinx,
        ];
        await db.collection("courses").insertMany(coursesList);
        console.log(
            `Successfully created ${coursesList.length} courses (1 main and 3 sub-courses).`,
        );

        // Helper to construct Date objects relative to today
        const getFutureDate = (
            dayOffset: number,
            hours: number,
            minutes: number,
        ): Date => {
            const d = new Date();
            d.setDate(d.getDate() + dayOffset);
            d.setHours(hours, minutes, 0, 0);
            return d;
        };

        const eventsList: any[] = [];
        const subCourseIds = ["bis-90-apollo", "bis-90-mivtzar", "bis-90-sphinx"];

        // 5. Generate events for a 7-day schedule (today to today + 6)
        console.log("Generating calendar events...");
        for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
            // Monday to Friday typically, but let's populate all 7 days with realistic schedules
            const dateStr = getFutureDate(dayOffset, 0, 0).toDateString();
            console.log(`  Generating events for: ${dateStr}`);

            // A: Prayer - Shacharit (08:00 - 08:45)
            eventsList.push({
                id: uuidv4(),
                name: "תפילת שחרית",
                subject: 0,
                hiveModule: 0,
                startTime: getFutureDate(dayOffset, 8, 0),
                endTime: getFutureDate(dayOffset, 8, 45),
                type: EventType.PRAYER,
                prayerType: "shacharit",
                courses: subCourseIds,
                rooms: [],
                instructors: [],
                tags: [],
                notes: "תפילת שחרית בבית המדרש",
                locked: false,
                hidden: false,
                required: true,
                personalTalk: false,
            });

            // B: Break - Breakfast (08:45 - 09:15)
            eventsList.push({
                id: uuidv4(),
                name: "ארוחת בוקר",
                subject: 0,
                hiveModule: 0,
                startTime: getFutureDate(dayOffset, 8, 45),
                endTime: getFutureDate(dayOffset, 9, 15),
                type: EventType.BREAK,
                courses: subCourseIds,
                rooms: [],
                instructors: [],
                tags: [],
                notes: "",
                locked: false,
                hidden: false,
                required: false,
                personalTalk: false,
            });

            // C: Morning Lecture (09:15 - 12:00)
            if (subjects.length > 0) {
                // Select random subject
                const subject =
                    subjects[Math.floor(Math.random() * subjects.length)];
                // Find modules of this subject
                const subjectModules = modules.filter(
                    (m: any) => m.parent_subject_id === subject.id,
                );
                const module =
                    subjectModules.length > 0
                        ? subjectModules[
                              Math.floor(Math.random() * subjectModules.length)
                          ]
                        : { id: 0 };

                // Select a room
                const room =
                    rooms.length > 0
                        ? rooms[Math.floor(Math.random() * rooms.length)]
                        : null;
                const roomResolvable = room ? [{ id: room.id, source: 1 }] : [];

                // Instructors
                const instructors = getRandomSegel(1);
                // Lecturer is a person ID (either number or "איש חוץ")
                const lecturer =
                    Math.random() > 0.3 && instructors.length > 0
                        ? instructors[0]
                        : "איש חוץ";

                eventsList.push({
                    id: uuidv4(),
                    name: `הרצאה: ${subject.name}`,
                    subject: subject.id,
                    hiveModule: module.id,
                    startTime: getFutureDate(dayOffset, 9, 15),
                    endTime: getFutureDate(dayOffset, 12, 0),
                    type: EventType.LECTURE,
                    courses: [subCourseIds[dayOffset % subCourseIds.length]], // Assign to one of the sub-courses
                    rooms: roomResolvable,
                    instructors: instructors,
                    lecturers: [lecturer],
                    tags: [],
                    notes: `הרצאה בנושא ${subject.name} - מודול ${module.name || "כללי"}`,
                    locked: false,
                    hidden: false,
                    required: true,
                    personalTalk: false,
                });
            }

            // D: Midday Exercise / Practice (12:00 - 13:00)
            if (subjects.length > 0) {
                const subject =
                    subjects[Math.floor(Math.random() * subjects.length)];
                const subjectModules = modules.filter(
                    (m: any) => m.parent_subject_id === subject.id,
                );
                const module =
                    subjectModules.length > 0
                        ? subjectModules[
                              Math.floor(Math.random() * subjectModules.length)
                          ]
                        : { id: 0 };

                const room =
                    rooms.length > 0
                        ? rooms[Math.floor(Math.random() * rooms.length)]
                        : null;
                const roomResolvable = room ? [{ id: room.id, source: 1 }] : [];

                eventsList.push({
                    id: uuidv4(),
                    name: `תרגול: ${subject.name}`,
                    subject: subject.id,
                    hiveModule: module.id,
                    startTime: getFutureDate(dayOffset, 12, 0),
                    endTime: getFutureDate(dayOffset, 13, 0),
                    type: EventType.EXERCISE,
                    courses: [subCourseIds[dayOffset % subCourseIds.length]],
                    rooms: roomResolvable,
                    instructors: getRandomSegel(2),
                    tags: [],
                    notes: "תרגול עצמי והגשות במערכת",
                    locked: false,
                    hidden: false,
                    required: true,
                    personalTalk: false,
                });
            }

            // E: Break - Lunch (13:00 - 14:00)
            eventsList.push({
                id: uuidv4(),
                name: "ארוחת צהריים",
                subject: 0,
                hiveModule: 0,
                startTime: getFutureDate(dayOffset, 13, 0),
                endTime: getFutureDate(dayOffset, 14, 0),
                type: EventType.BREAK,
                courses: subCourseIds,
                rooms: [],
                instructors: [],
                tags: [],
                notes: "",
                locked: false,
                hidden: false,
                required: false,
                personalTalk: false,
            });

            // F: Prayer - Mincha (14:00 - 14:30)
            eventsList.push({
                id: uuidv4(),
                name: "תפילת מנחה",
                subject: 0,
                hiveModule: 0,
                startTime: getFutureDate(dayOffset, 14, 0),
                endTime: getFutureDate(dayOffset, 14, 30),
                type: EventType.PRAYER,
                prayerType: "mincha",
                courses: subCourseIds,
                rooms: [],
                instructors: [],
                tags: [],
                notes: "תפילת מנחה בבית המדרש",
                locked: false,
                hidden: false,
                required: true,
                personalTalk: false,
            });

            // G: Afternoon Class/Session (14:30 - 17:00) - alternating type
            const afternoonType =
                dayOffset % 2 === 0 ? EventType.LECTURE : EventType.EXERCISE;
            if (subjects.length > 0) {
                const subject =
                    subjects[Math.floor(Math.random() * subjects.length)];
                const subjectModules = modules.filter(
                    (m: any) => m.parent_subject_id === subject.id,
                );
                const module =
                    subjectModules.length > 0
                        ? subjectModules[
                              Math.floor(Math.random() * subjectModules.length)
                          ]
                        : { id: 0 };

                const room =
                    rooms.length > 0
                        ? rooms[Math.floor(Math.random() * rooms.length)]
                        : null;
                const roomResolvable = room ? [{ id: room.id, source: 1 }] : [];

                const instructors = getRandomSegel(1);
                const lecturer =
                    instructors.length > 0 ? instructors[0] : "איש חוץ";

                eventsList.push({
                    id: uuidv4(),
                    name:
                        afternoonType === EventType.LECTURE
                            ? `הרצאת אחה"צ: ${subject.name}`
                            : `תרגול מעשי: ${subject.name}`,
                    subject: subject.id,
                    hiveModule: module.id,
                    startTime: getFutureDate(dayOffset, 14, 30),
                    endTime: getFutureDate(dayOffset, 17, 0),
                    type: afternoonType,
                    courses: [
                        subCourseIds[(dayOffset + 1) % subCourseIds.length],
                    ],
                    rooms: roomResolvable,
                    instructors: instructors,
                    lecturers:
                        afternoonType === EventType.LECTURE
                            ? [lecturer]
                            : undefined,
                    tags: [],
                    notes: "סשן למידה אינטנסיבי",
                    locked: false,
                    hidden: false,
                    required: true,
                    personalTalk: false,
                });
            }

            // H: Prayer - Arvit (17:00 - 17:30)
            eventsList.push({
                id: uuidv4(),
                name: "תפילת ערבית",
                subject: 0,
                hiveModule: 0,
                startTime: getFutureDate(dayOffset, 17, 0),
                endTime: getFutureDate(dayOffset, 17, 30),
                type: EventType.PRAYER,
                prayerType: "arvit",
                courses: subCourseIds,
                rooms: [],
                instructors: [],
                tags: [],
                notes: "תפילת ערבית בבית המדרש",
                locked: false,
                hidden: false,
                required: true,
                personalTalk: false,
            });

            // I: Other - Daily Summary (17:30 - 18:30)
            const room =
                rooms.length > 0
                    ? rooms[Math.floor(Math.random() * rooms.length)]
                    : null;
            const roomResolvable = room ? [{ id: room.id, source: 1 }] : [];

            eventsList.push({
                id: uuidv4(),
                name: "סיכום יום",
                subject: 0,
                hiveModule: 0,
                startTime: getFutureDate(dayOffset, 17, 30),
                endTime: getFutureDate(dayOffset, 18, 30),
                type: EventType.OTHER,
                courses: subCourseIds,
                rooms: roomResolvable,
                instructors: getRandomSegel(1),
                tags: [],
                notes: "סיכום יומי ומענה לשאלות פתוחות של חניכים",
                locked: false,
                hidden: false,
                required: true,
                personalTalk: false,
            });
        }

        // Write events to DB
        await db.collection("events").insertMany(eventsList);
        console.log(
            `Successfully created ${eventsList.length} calendar events in MongoDB.`,
        );

        console.log("Database seeding completed successfully!");
    } catch (err) {
        console.error("An error occurred during database seeding:", err);
    } finally {
        await client.close();
    }
}

main().catch(console.error);
