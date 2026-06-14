/*
Name: populate_bluz.ts
Purpose: Seeds hardcoded schedule events into the local Bluz MongoDB instance.
Created: 2026-06-04
Author: Michael K. Steinberg
*/

import crypto from "crypto";
import fs from "fs";
import { Db, MongoClient } from "mongodb";

// -----------------------------------------------------------------------------
// Domain Models & Interfaces
// -----------------------------------------------------------------------------

enum EventType {
  EXERCISE = 'ע"ע',
  LECTURE = "הרצאה",
  BREAK = "הפסקה",
  PRAYER = "תפילה",
  OTHER = "אחר",
}

type ResolvableRoom = {
  id: string;
  source: 0;
};

type DbEventDocument = {
  id: string;
  name: string;
  subject: number;
  hiveModule: number;
  startTime: Date;
  endTime: Date;
  type: EventType;
  courses: string[];
  rooms: ResolvableRoom[];
  instructors: number[];
  lecturers?: (number | string)[];
  tags: number[];
  notes: string;
  locked: boolean;
  hidden: boolean;
  required: boolean;
  personalTalk: boolean;
  prayerType?: "shacharit" | "mincha" | "arvit";
};

interface IRawEvent {
  name: string;
  axis?: string;
  durationHours: number;
  dateStr?: string;
  notes?: string;
  inCharge?: string;
  lecturer?: string;
}

// -----------------------------------------------------------------------------
// Hardcoded Data Payload
// -----------------------------------------------------------------------------

const RAW_EVENTS: IRawEvent[] = [
  {
    name: "היכרות עם רמות",
    axis: "שגרה",
    durationHours: 1,
    dateStr: "2026-02-02",
    notes: "מצגת מתוקפת בתיקיית הכנס. טוב, כדאי להבין מה עברו בקפה...",
    inCharge: "איה",
    lecturer: "איה",
  },
  {
    name: "הצגת ההכנס",
    axis: "שגרה",
    durationHours: 0.5,
    dateStr: "2026-02-02",
    notes: "מצגת מתוקפת בתיקיית הכנס",
    inCharge: "איה",
    lecturer: "איה",
  },
  {
    name: "היכרות לירן",
    axis: "שגרה",
    durationHours: 0.5,
    dateStr: "2026-02-02",
    notes: "מעולה כרגיל",
    inCharge: "לירן",
    lecturer: "לירן",
  },
  {
    name: "פרמוט מחשבים ביום הראשון",
    axis: "איש הסגל",
    durationHours: 2,
    dateStr: "2026-02-02",
    notes:
      "להכין מצגצ תדרוך, יחד עם הצגת סביבת עבודה ותיקיות. כדאי לאפשר לחלק מהאנשים להתחבר בבוקר",
    inCharge: "אופק",
    lecturer: "אופק",
  },
  {
    name: "פיקוד מגדרי",
    axis: "איש הסגל",
    durationHours: 1,
    dateStr: "2026-03-17",
    notes: "לדבר עם אלמוג לקראת ההרצאה",
    inCharge: "אור",
    lecturer: "אלמוג",
  },
  {
    name: "גיבוש פתיחה",
    axis: "גיבוש",
    durationHours: 1,
    dateStr: "2026-02-02",
    inCharge: "שירה",
    lecturer: "שירה",
  },
  {
    name: "שיחת פתיחה קורסי",
    axis: "איש הסגל",
    durationHours: 1,
    dateStr: "2026-02-02",
    notes: "תיאום ציפיות, תחקור קפה, מסרים של המקס",
    inCharge: "מקסים",
    lecturer: "מקסים",
  },
  {
    name: "חשיפת מקצועות - שעשועון",
    axis: "איש הסגל",
    durationHours: 1,
    dateStr: "2026-02-02",
    notes: "צריך לקרות ביום הראשון בערב. מוצלח, לקח פחות זמן בפועל.",
    inCharge: "שירה",
    lecturer: "שירה",
  },
  {
    name: "מופע חלוקת אחריות רוחב",
    axis: "איש הסגל",
    durationHours: 1,
    dateStr: "2026-02-02",
    notes: "צריך לקרות ביום הראשון בערב. מוצלח.",
    inCharge: "אור",
    lecturer: "אור",
  },
  {
    name: "השלמת תזים מקסים אלון ואופק",
    axis: "גיבוש",
    durationHours: 1,
    dateStr: "2026-02-03",
    inCharge: "אופק",
    lecturer: "אופק",
  },
  {
    name: "סדנת עבודה על מקצוע - קוסטיו",
    axis: "איש הסגל",
    durationHours: 2,
    dateStr: "2026-02-04",
    inCharge: "שירה",
    lecturer: "שירה",
  },
  {
    name: "תדרוך עבודה על מקצוע",
    axis: "איש הסגל",
    durationHours: 0.5,
    dateStr: "2026-02-04",
    notes: "מצגת ברשת",
    inCharge: "איה",
    lecturer: "איה",
  },
  {
    name: "הצגת דמויות בוגר לקורס",
    axis: "איש הסגל",
    durationHours: 1.5,
    dateStr: "2026-02-03",
    inCharge: "מקסים",
    lecturer: "מקסים",
  },
  {
    name: "שיחה עם עידית",
    axis: "פיקוד הדרכתי",
    durationHours: 1.5,
    dateStr: "2026-02-04",
    inCharge: "איה",
    lecturer: "איה",
  },
  {
    name: "עבודה עם מילואים",
    axis: "איש הסגל",
    durationHours: 0.25,
    inCharge: "איה",
    lecturer: "איה",
  },
  {
    name: "הצגת דמות בוגר ביס 90",
    axis: "פיקוד הדרכתי",
    durationHours: 1,
    notes: "מסמך ברשת. היה מופע ממש מוצלח.",
    inCharge: "איה",
    lecturer: "איה",
  },
  {
    name: 'קב"הח סגל',
    durationHours: 1,
    dateStr: "2026-02-04",
    inCharge: "מקס שבועי",
    lecturer: "מקס שבועי",
  },
  {
    name: "מופע משמעת",
    axis: "איש הסגל",
    durationHours: 1,
    inCharge: "איה",
    lecturer: "איה",
  },
  {
    name: "איך נראה פא בביס",
    axis: "פיקוד הדרכתי",
    durationHours: 0.75,
    inCharge: "אור",
    lecturer: "אור",
  },
  {
    name: "איך מסבירים איסור השוואה - צדוק",
    axis: "פיקוד הדרכתי",
    durationHours: 1,
    dateStr: "2026-02-08",
    notes: "סטה לנושאים נוספים. כדאי שתהיה שיחה של 1.5.",
    inCharge: "אור",
    lecturer: "אור",
  },
  {
    name: "הצגת ספינקס וקמ״נים",
    axis: "פיקוד הדרכתי",
    durationHours: 0.5,
    notes: "לתאם עם גוני",
    inCharge: "איה",
    lecturer: "גוני",
  },
  {
    name: "שיחה עם תמר הקבנית",
    axis: "פיקוד הדרכתי",
    durationHours: 1.5,
    dateStr: "2026-02-17",
    notes: "לשריין אודיטוריום?",
    inCharge: "איה",
    lecturer: "איה",
  },
  {
    name: "מורק הדחה - עומר ארז",
    axis: "פיקוד הדרכתי",
    durationHours: 2,
    dateStr: "2026-03-04",
    notes: "לא אומרים לסגל על מה זה מראש",
  },
  {
    name: "תוכניות חניכה - חן, מומלץ",
    axis: "פיקוד הדרכתי",
    durationHours: 2,
    dateStr: "2026-05-02",
    notes: "לברר משך",
    inCharge: "אור",
    lecturer: "אור",
  },
  {
    name: "מרחק פיקודי",
    axis: "פיקוד הדרכתי",
    durationHours: 1,
    notes: "לתקף מצגת",
    inCharge: "איה",
    lecturer: "איה",
  },
  {
    name: "פיקוד הדרכתי - חן דדון",
    axis: "פיקוד הדרכתי",
    durationHours: 1,
    dateStr: "2026-02-05",
    notes: "מתפיסת פיקוד לפרקטיקה. כדאי לתת 1.25 שעות",
    inCharge: "אור",
    lecturer: "חן דדון",
  },
  {
    name: "מסוגלות - חן דדון",
    axis: "פיקוד הדרכתי",
    durationHours: 1,
    dateStr: "2026-05-02",
    notes: "על השימוש באצת.",
    inCharge: "אור",
    lecturer: "חן דדון",
  },
  {
    name: "הדחות בבי״ס",
    axis: "פיקוד הדרכתי",
    durationHours: 1,
    dateStr: "2026-02-09",
    notes: "יש מצגת ברשת",
    inCharge: "איה",
  },
  {
    name: "סדנת חניכה - טל אלישוב",
    axis: "פיקוד הדרכתי",
    durationHours: 7,
    dateStr: "2026-03-03",
    notes: "לתאם!",
    inCharge: "אור",
    lecturer: "אור",
  },
  {
    name: "כנס אבטחה",
    axis: "שגרה",
    durationHours: 2,
    dateStr: "11.2.26",
    inCharge: "איה",
    lecturer: "מטה",
  },
  {
    name: "איך יעבדו השיבוצים",
    axis: "איש הסגל",
    durationHours: 1,
    dateStr: "2026-02-11",
    notes: "מופע קורסי משובים, שיבוצים",
    inCharge: "כולם",
    lecturer: "כולם",
  },
  {
    name: "משובים בקורס",
    axis: "פיקוד הדרכתי",
    durationHours: 1,
    dateStr: "2026-02-12",
    notes: "משובים שהסגל כותבים",
    inCharge: "כולם",
    lecturer: "כולם",
  },
  {
    name: 'קב"הח חניכים',
    durationHours: 1,
    dateStr: "2026-02-08",
    inCharge: "מקס שבועי",
    lecturer: "מקס שבועי",
  },
  {
    name: "ניהול זמן איש סגל",
    axis: "פיקוד הדרכתי",
    durationHours: 1,
    dateStr: "2026-02-05",
    notes: "חן. יש מצגות על זה ברשת.",
    inCharge: "אור",
    lecturer: "אור",
  },
  {
    name: "שיאוניסטיות",
    axis: "איש הסגל",
    durationHours: 0.45,
    dateStr: "2026-02-09",
    notes: "מצגת בירוק",
    inCharge: "שירה",
    lecturer: "שירה",
  },
  {
    name: "אמנוניסטים",
    axis: "איש הסגל",
    durationHours: 0.45,
    dateStr: "2026-02-10",
    notes: "איפה המצגת?",
    inCharge: "אור",
    lecturer: "אור",
  },
  {
    name: "אור מסבירה על התנסויות חניכים (ואיך יבחרו)",
    axis: "איש הסגל",
    durationHours: 0.5,
    dateStr: "2026-02-11",
    notes: "הנצחה, מה קורה בביס, חנתר, חץ",
    inCharge: "אור",
    lecturer: "אור",
  },
  {
    name: "היכרות עם המטה",
    axis: "שגרה",
    durationHours: 3,
    dateStr: "2026-02-15",
    notes: "דורש תיאום מול מאי קצינת אגם",
    inCharge: "לירן",
    lecturer: "מטה",
  },
  {
    name: "טיטאן",
    axis: "איש הסגל",
    durationHours: 3.5,
    dateStr: "2026-02-18",
    notes: "תדרוך ומעבר על תכנים",
    inCharge: "אלון",
    lecturer: "אלון",
  },
  {
    name: "מטווחים",
    durationHours: 0,
    dateStr: "22.2.26",
    inCharge: "איה",
    lecturer: "איה",
  },
  {
    name: "נהלים של חניכים",
    axis: "איש הסגל",
    durationHours: 1,
    notes: "שילוב ראוי, דיגום, חלבייה",
    inCharge: "איה",
    lecturer: "איה",
  },
  {
    name: "מה זה מדרת",
    axis: "איש הסגל",
    durationHours: 0.75,
    notes: "בנוסף, לתאם שמישהו יגיע ליומיים הראשונים",
    inCharge: "שירה",
    lecturer: "סגל כו",
  },
  {
    name: "יום פיקוד במלחמה",
    axis: "פיקוד הדרכתי",
    durationHours: 6,
    dateStr: "2026-03-01",
    notes: "מתוכנן באברהם הוסטל תל אביב",
    inCharge: "איה",
    lecturer: "מקסים",
  },
  {
    name: "הצגת מערכות ותוכנות הביס",
    axis: "איש הסגל",
    durationHours: 1,
    dateStr: "2026-03-10",
    inCharge: "שירה",
    lecturer: "נבחרת תוכנות",
  },
  {
    name: "הצגת מבצר",
    axis: "איש הסגל",
    durationHours: 0.5,
    notes: "הצגת שינויים במחזור",
    inCharge: "אלון",
    lecturer: "אלון",
  },
  {
    name: "הצגת אפולו",
    axis: "איש הסגל",
    durationHours: 0.5,
    notes: "הצגת שינויים במחזור",
    inCharge: "אור",
    lecturer: "אור",
  },
  {
    name: "הצגת חרמון ושיאון",
    axis: "איש הסגל",
    durationHours: 0.5,
    notes: "הצגת שינויים במחזור",
    inCharge: "שירה",
    lecturer: "שירה",
  },
  {
    name: "מסדר דגל",
    axis: "שגרה",
    durationHours: 0.25,
    dateStr: "2026-03-12",
    notes: "ללכת פעם אחת עם הביס",
    inCharge: "איה",
    lecturer: "איה",
  },
  {
    name: "יום הצגת מקצועות- ביסי",
    axis: "איש הסגל",
    durationHours: 3,
    dateStr: "2026-03-23",
    inCharge: "אלון",
    lecturer: "אלון",
  },
  {
    name: "יום הצגת מקצועות - קורסי",
    durationHours: 3,
    dateStr: "2026-03-23",
    inCharge: "מקסים",
    lecturer: "מקסים",
  },
  {
    name: "יום בחיי חניך - מידולים",
    axis: "איש הסגל",
    durationHours: 4,
    dateStr: "2026-04-06",
    notes: "מידול העברת הרצאות בכיתות האמיתיות",
    inCharge: "אופק",
    lecturer: "אופק",
  },
  {
    name: "הצגת תחקיר - תומר",
    axis: "פיקוד הדרכתי",
    durationHours: 2,
    dateStr: "2026-03-18",
    notes: "נדחה",
    inCharge: "איה",
    lecturer: "תומר זלמנסון",
  },
  {
    name: "הצגת תחקיר - ניצן",
    axis: "פיקוד הדרכתי",
    durationHours: 2,
    dateStr: "2026-02-24",
    inCharge: "איה",
    lecturer: "ניצן הבלר",
  },
  {
    name: "עיבוד הצגת תחקיר",
    axis: "פיקוד הדרכתי",
    durationHours: 1,
    notes: "בהתאם לתחקיר",
    inCharge: "איה",
    lecturer: "איה",
  },
  {
    name: "חשיפת חלוקת חניכים לסגל",
    axis: "איש הסגל",
    durationHours: 1,
    dateStr: "2026-03-25",
    inCharge: "כולם",
    lecturer: "כולם",
  },
  {
    name: "פא 0 - מחייגים לחניכים",
    axis: "פיקוד הדרכתי",
    durationHours: 1.5,
    dateStr: "2026-03-26",
    inCharge: "איה",
    lecturer: "איה",
  },
  {
    name: "תדרוך ריאיון קליטה",
    axis: "איש הסגל",
    durationHours: 0.25,
    dateStr: "2026-04-07",
    notes: "הסבר על ריאיונות קליטה",
    inCharge: "איה",
    lecturer: "איה",
  },
  {
    name: "טקטי",
    durationHours: 25,
    dateStr: "5.4.26-7.4.26",
    inCharge: "אופק",
    lecturer: "אופק",
  },
  {
    name: "תדרוך שבוע ראשון",
    durationHours: 0.45,
    dateStr: "2026-04-07",
    notes: "הסבר איך יתנהל השבוע הראשון",
    inCharge: "אור",
    lecturer: "אור",
  },
  {
    name: 'תדרוך פ"א 0',
    durationHours: 0.25,
    dateStr: "2026-03-26",
    notes: "להכין פתבס",
    inCharge: "איה",
    lecturer: "איה",
  },
  {
    name: "תדרוך שבוע ראשון ויום קליטה",
    durationHours: 1,
    dateStr: "2026-04-07",
    inCharge: "אור",
    lecturer: "אור",
  },
  {
    name: "תדרוך רפואה ואפיפנים",
    axis: "שגרה",
    durationHours: 1,
    inCharge: "לירן",
    lecturer: "מטה",
  },
  { name: "ניקיון חדס", durationHours: 0.5 },
  { name: "סימולציות", durationHours: 5, notes: "יש חוברת סימולציות מומלצת" },
  {
    name: "תזים",
    durationHours: 4.5,
    notes: "15 דקות לכל אחד",
    inCharge: "מקס שבועי",
    lecturer: "מקס שבועי",
  },
  {
    name: "אימונים",
    durationHours: 6,
    notes: "הסגל מוסמך ויכול להעביר אגים בעצמו",
    inCharge: "אור",
    lecturer: "אור",
  },
  { name: "גיבוש", durationHours: 10, inCharge: "שירה", lecturer: "הווי" },
  {
    name: "שריון חלונות זמן לנבחרות",
    durationHours: 10,
    inCharge: "מקס שבועי",
    lecturer: "מקס שבועי",
  },
  {
    name: "סיכום שבוע",
    axis: "שגרה",
    durationHours: 0.5,
    inCharge: "מקס שבועי",
    lecturer: "מקס שבועי",
  },
  {
    name: "דייטים",
    axis: "גיבוש",
    durationHours: 6,
    inCharge: "שירה",
    lecturer: "שירה",
  },
  {
    name: "כנס בטיחות",
    axis: "שגרה",
    durationHours: 1.5,
    notes: "תוכן חובה של המטה",
    inCharge: "מטה",
    lecturer: "מטה",
  },
];

// -----------------------------------------------------------------------------
// Utilities & Parsers
// -----------------------------------------------------------------------------

class EnvironmentConfig {
  public static getMongoConnectionString(): string {
    if (fs.existsSync(".env")) {
      process.loadEnvFile(".env");
    }

    let connectionString = "";
    try {
      const envContent = fs.readFileSync(".env", "utf8");
      const match = envContent.match(/^MONGO_CONNECTION_STRING=(.*)$/m);
      if (match && match[1]) {
        connectionString = match[1].trim();
      }
    } catch (error) {
      connectionString =
        process.env.MONGO_CONNECTION_STRING || "mongodb://127.0.0.1:27017";
    }

    if (!fs.existsSync("/.dockerenv")) {
      connectionString = connectionString.replace(
        "bluz-mongodb:27017",
        "127.0.0.3:27018",
      );
    }

    return connectionString;
  }
}

class DateParser {
  /**
   * Parses custom date strings into UTC Date objects.
   * Handles formats like `YYYY-MM-DD`, `DD.MM.YY`, and ranges `DD.MM.YY-DD.MM.YY`.
   */
  public static parse(dateStr: string | undefined): Date {
    if (!dateStr) return new Date("2026-01-01T08:00:00Z"); // Fallback for dateless events

    if (dateStr.includes(".")) {
      const firstDate = dateStr.split("-")[0].trim();
      const [day, month, year] = firstDate.split(".");
      const fullYear = year.length === 2 ? `20${year}` : year;
      return new Date(
        `${fullYear}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T08:00:00Z`,
      );
    }

    return new Date(`${dateStr}T08:00:00Z`);
  }
}

class EventMapper {
  /**
   * Maps the raw payload entries to MongoDB Event Documents.
   */
  public static mapToDocuments(rawEvents: IRawEvent[]): DbEventDocument[] {
    return rawEvents.map((row) => {
      const startTime = DateParser.parse(row.dateStr);
      const endTime = new Date(
        startTime.getTime() + (row.durationHours || 1) * 60 * 60 * 1000,
      );

      return {
        id: crypto.randomUUID(),
        name: row.name.trim(),
        subject: 0,
        hiveModule: 0,
        startTime,
        endTime,
        type: this.mapEventType(row.axis),
        courses: ["local-course-default"],
        rooms: [{ id: "local-room-default", source: 0 }],
        instructors: row.inCharge
          ? [this.hashStringToLocalId(row.inCharge)]
          : [],
        lecturers: row.lecturer ? [row.lecturer] : [],
        tags: [],
        notes: row.notes || "",
        locked: false,
        hidden: false,
        required: true,
        personalTalk: false,
      };
    });
  }

  private static mapEventType(rawType?: string): EventType {
    if (!rawType) return EventType.OTHER;
    if (rawType.includes("הרצאה")) return EventType.LECTURE;
    if (rawType.includes("הפסקה")) return EventType.BREAK;
    if (rawType.includes("תפילה")) return EventType.PRAYER;
    return EventType.OTHER;
  }

  private static hashStringToLocalId(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
}

// -----------------------------------------------------------------------------
// Services
// -----------------------------------------------------------------------------

class DatabaseSeeder {
  private client: MongoClient;
  private dbName = "bluz";
  private collectionName = "events";

  constructor(connectionString: string) {
    this.client = new MongoClient(connectionString);
  }

  public async seed(events: DbEventDocument[]): Promise<void> {
    try {
      await this.client.connect();
      const db: Db = this.client.db(this.dbName);
      const collection = db.collection<DbEventDocument>(this.collectionName);

      console.log(`[INFO] Connected to MongoDB database: ${this.dbName}`);

      await collection.deleteMany({});
      console.log(`[INFO] Cleared existing collection: ${this.collectionName}`);

      if (events.length > 0) {
        await collection.insertMany(events);
        console.log(
          `[SUCCESS] Seeded ${events.length} events into ${this.collectionName}.`,
        );
      } else {
        console.log(`[WARNING] No events found to seed.`);
      }
    } catch (error) {
      console.error("[ERROR] Seeding failed:", error);
      throw error;
    } finally {
      await this.client.close();
      console.log("[INFO] Database connection closed.");
    }
  }
}

// -----------------------------------------------------------------------------
// Application Entry Point
// -----------------------------------------------------------------------------

async function main() {
  try {
    const uri = EnvironmentConfig.getMongoConnectionString();
    console.log(`[INFO] Initializing seeding process targeting: ${uri}`);

    const parsedEvents = EventMapper.mapToDocuments(RAW_EVENTS);

    const seeder = new DatabaseSeeder(uri);
    await seeder.seed(parsedEvents);
  } catch (error) {
    console.error("[FATAL] Application terminated unexpectedly.");
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
