/*
 * Name: import_gantt.ts
 * Purpose: Seeds Gantt syllabuses/modules/events into a live PostgreSQL (curriculum_db) instance.
 *          Reads connection string from .env-mks-srvu.
 *          Each syllabus gets its own module instances (no cross-syllabus sharing).
 *          IDs use the app's convention: s_<uuid>, m_<uuid>, e_<uuid>.
 * Created: 2026-06-15
 * Author: Michael K. Steinberg
 */

import crypto from "crypto";
import fs from "fs";
import { Client } from "pg";

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const uid = () => crypto.randomUUID();
const sid = () => `s_${uid()}`;
const mid = () => `m_${uid()}`;
const eid = () => `e_${uid()}`;

// -----------------------------------------------------------------------------
// Input Payload
// Modules are grouped by THEME (no "שבוע X" labels). The week-based layout was
// flattened and rebuilt into functional axes/modules so the Gantt reads as
// cohesive topic groups instead of a calendar.
//
// KAPE reservation: the course starts Sunday 2026-08-02 (week 1). Weeks 3-5
// (2026-08-16 .. 2026-09-06) are reserved for קפ"ה and kept clear — events that
// previously lived in those weeks were rehoused into their thematic modules,
// which schedule outside the reserved block. A dedicated reserved axis marks the
// period so nothing gets slotted into it.
// -----------------------------------------------------------------------------

const GANTT_DATA = [
  // ─── ציר: אדמיניסטרציה וסנכרונים ─────────────────────────────────────────
  {
    syllabus_name: "אדמיניסטרציה וסנכרונים",
    modules: [
      {
        module_name: "דד-ליינים ואישורים",
        events: [
          { name: "דד ליין הייב", duration_hours: 0.0, comments: "" },
          { name: "דד ליין אימגים", duration_hours: 0.0, comments: "" },
          { name: "אישורי תכניות מקצועות", duration_hours: 0.0, comments: "" },
          { name: "יום הצגת מערכים - קורסי", duration_hours: 0.0, comments: "" },
          { name: "אישור תכניות שבוע טקטי", duration_hours: 0.0, comments: "" },
          { name: "דד ליין גאנט", duration_hours: 0.0, comments: "" },
        ],
      },
      {
        module_name: "נתוני חניכים וסנכרונים",
        events: [
          { name: "עיבוד פרטי חניכים", duration_hours: 0.0, comments: "" },
          {
            name: 'סנכרון מק"סים',
            duration_hours: 0.0,
            comments: 'סנכרון יומי של המק"סים',
          },
          { name: "שליחת שאלון לחניכים שיאון", duration_hours: 0.0, comments: "" },
          {
            name: 'שליחת שאלון לבי"ס - חודש מראש',
            duration_hours: 0.0,
            comments: "אצל ג'וש",
          },
        ],
      },
      {
        module_name: "פתוח לבירור",
        events: [
          {
            name: "איתור - בבחינה",
            duration_hours: 0.0,
            comments:
              "לברר מה היה בהרצאה, להבין האם אנחנו רוצים להכניס ולתאם בהתאם.",
          },
          { name: "איך מדברים על חניכים - לברר", duration_hours: 0.0, comments: "" },
          { name: "התנדבות?", duration_hours: 0.0, comments: "" },
        ],
      },
    ],
  },

  // ─── ציר: קב"החים ─────────────────────────────────────────────────────────
  {
    syllabus_name: 'קב"החים',
    modules: [
      {
        module_name: 'קב"החים',
        events: [
          { name: 'קב"הח סגל', duration_hours: 1.0, comments: "" },
          { name: 'קב"הח חניכים', duration_hours: 1.0, comments: "" },
        ],
      },
    ],
  },

  // ─── ציר: פתיחת הכנס והיכרות ──────────────────────────────────────────────
  {
    syllabus_name: "פתיחת הכנס והיכרות",
    modules: [
      {
        module_name: "ימי פתיחה והיכרות",
        events: [
          {
            name: "היכרות עם רמות",
            duration_hours: 1.0,
            comments: "מצגת מתוקפת בתיקיית הכנס",
          },
          {
            name: "הצגת ההכנס",
            duration_hours: 0.5,
            comments: "מצגת מתוקפת בתיקיית הכנס",
          },
          { name: "היכרות לירן", duration_hours: 0.5, comments: "" },
          { name: "היכרות ליאור", duration_hours: 0.5, comments: "" },
          {
            name: "היכרות חניכים",
            duration_hours: 1.5,
            comments:
              "כל מפקד מציג את החניכים שלו לכלל הסגל (יש לאסוף נתונים ולרשום במצגת נתונים, תחביבים ופרטים רלוונטים על החניך)",
          },
          { name: "הכרת דמויות במערך", duration_hours: 0.5, comments: "" },
          {
            name: "שלומויות - עם היוהלמ",
            duration_hours: 1.0,
            comments: "להזמין אותם",
          },
        ],
      },
    ],
  },

  // ─── ציר: הכשרת איש הסגל ──────────────────────────────────────────────────
  {
    syllabus_name: "הכשרת איש הסגל",
    modules: [
      {
        module_name: "סביבת עבודה ונהלים",
        events: [
          {
            name: "פרמוט מחשבים ביום הראשון",
            duration_hours: 2.0,
            comments: "להכין מצגצ תדרוך, יחד עם הצגת סביבת עבודה ותיקיות.",
          },
          {
            name: "אבטחת מידע",
            duration_hours: 0.5,
            comments:
              "להעביר ביום שמתקינים תוכנות וכו'. לדבר על כוננים, סיווגים וביטחון מידע בקורס (גם על דלתיים פתוחות).",
          },
          { name: "נהלי משמעת ולבוש בסמך", duration_hours: 0.5, comments: "" },
          { name: "ביש לוגיסטי", duration_hours: 0.5, comments: "" },
          {
            name: "שגרת המחלקה",
            duration_hours: 1.0,
            comments: "מסדר בוקר, נהלי עמידה בזמנים, חלוקת תפקידים ועוד.",
          },
          { name: "תדרוך עמדות תורן", duration_hours: 1.0, comments: "" },
        ],
      },
      {
        module_name: "כשירות אישית ורווחת הסגל",
        events: [
          {
            name: "שיח רפואי + ביש הגשה - להביא רופא",
            duration_hours: 1.0,
            comments: "עדיף רופא - גם עשה סדר במרפאה",
          },
          {
            name: "פיקוד מגדרי",
            duration_hours: 1.0,
            comments: "לדבר עם אלמוג לקראת ההרצאה",
          },
          {
            name: "מתיחות והחזקה (עמית מרום / שניידר?)",
            duration_hours: 1.0,
            comments: "",
          },
          { name: "מניעת אובדנות - קבנית", duration_hours: 1.5, comments: "" },
          { name: "רפלקציה", duration_hours: 1.0, comments: "" },
          { name: "סדנת צילום", duration_hours: 1.0, comments: "" },
        ],
      },
      {
        module_name: "תורת ההדרכה והלמידה",
        events: [
          {
            name: "מבוא לחניך - מאפיינים, יחס חניך מפקד, אירוע הדרכתי",
            duration_hours: 1.0,
            comments: "",
          },
          { name: "תפיסת ההדרכה", duration_hours: 1.5, comments: "" },
          {
            name: "תורת הלמידה - סגנונות, מודלים, הערכה",
            duration_hours: 1.5,
            comments: "",
          },
          { name: "תיקון שגיאות / מתן פידבק", duration_hours: 1.0, comments: "" },
          { name: "עמידה מול קהל", duration_hours: 1.5, comments: "" },
          {
            name: "שעות שילוב",
            duration_hours: 0.5,
            comments: "הנחיות לשעות שילוב - מתי אפשר, מה מותר, התנהלות",
          },
          {
            name: "תשאול ועיבוד",
            duration_hours: 1.0,
            comments:
              "הסבר על מודל התשאול ועל ההבדל בינו לבין עיבוד. כדאי להתחיל להעביר קצת תוכן מנהיגות לפני זה.",
          },
        ],
      },
    ],
  },

  // ─── ציר: פיקוד והדרכה ────────────────────────────────────────────────────
  {
    syllabus_name: "פיקוד והדרכה",
    modules: [
      {
        module_name: "זיהוי והיכרות חניכים",
        events: [
          {
            name: "משחק זיהוי חניכים - גיבושים",
            duration_hours: 0.5,
            comments:
              "לתת לכל מפקד שם של חניך והוא צריך לזהות אותו בתמונות או סרטונים מהגיבוש",
          },
          {
            name: "משחק זיהוי חניכים - טריוויה",
            duration_hours: 1.0,
            comments: "שאלות טריוויה על החניכים",
          },
          {
            name: "מבוא לחניך - חקר מקרי בוחן",
            duration_hours: 1.5,
            comments: "ניתוח אירועים ממשמרות או קורסים קודמים",
          },
          { name: "חשיפת חלוקת חניכים לסגל", duration_hours: 1.0, comments: "" },
        ],
      },
      {
        module_name: "כלים פיקודיים",
        events: [
          {
            name: "סימולציות פיקודיות - מקרים ותגובות",
            duration_hours: 2.0,
            comments: "דיבייט / סימולציות - תרחישים בין מפקד לחניך, מפקד למפקד",
          },
          {
            name: "הכנה למפגש הורים",
            duration_hours: 1.0,
            comments: "תדרוך לקראת המפגש, קווים מנחים",
          },
        ],
      },
      {
        module_name: "תחקירים",
        events: [
          {
            name: "הצגת תחקיר - מקצועי/הדרכתי",
            duration_hours: 2.0,
            comments:
              "עבר טוב, ההצגה עצמה הייתה שעה, ואז עשינו באודיטוריום המשך עיבוד של איה עם הסגל",
          },
          {
            name: "עיבוד הצגת תחקיר",
            duration_hours: 1.0,
            comments: "בהתאם לתחקיר",
          },
        ],
      },
      {
        module_name: 'ריאיונות ופ"א',
        events: [
          { name: "תדרוך לראיונות קליטה", duration_hours: 0.25, comments: "" },
          {
            name: "תדרוך ריאיון קליטה",
            duration_hours: 0.25,
            comments: "הסבר על ריאיונות קליטה - דגשים למילוי",
          },
          { name: "פא 0 - מחייגים לחניכים", duration_hours: 1.5, comments: "" },
        ],
      },
    ],
  },

  // ─── ציר: שגרת הכנס ומסכמים ───────────────────────────────────────────────
  {
    syllabus_name: "שגרת הכנס ומסכמים",
    modules: [
      {
        module_name: "שיחות חתך ומסכמים",
        events: [
          { name: "שיחת חתך - אמצע", duration_hours: 3.0, comments: "" },
          {
            name: "שיחת חתך - סוף הכנס (חלק מהמסכם)",
            duration_hours: 1.5,
            comments: "",
          },
          {
            name: "מסכם הכנס",
            duration_hours: 8.0,
            comments:
              "כל מפקד יעביר הרצאה מסכמת על העשייה שלו בהכנס (כ-20 דקות). לאחר מכן, מסכמים עם איה על כל ההכנס.",
          },
        ],
      },
      {
        module_name: 'שיאון ופתב"ס',
        events: [
          {
            name: 'איך כותבים פתב"ס',
            duration_hours: 0.5,
            comments: "להדגיש את אופן הכתיבה והעקרונות, במיוחד כי מתחילים שיאון",
          },
        ],
      },
    ],
  },

  // ─── ציר: גיבוש ───────────────────────────────────────────────────────────
  {
    syllabus_name: "גיבוש",
    modules: [
      {
        module_name: "גיבוש",
        events: [
          { name: "חווית שטח", duration_hours: 20.0, comments: "" },
          { name: "ערבי גיבוש", duration_hours: 2.0, comments: "" },
          { name: "קפה יום גיבוש - מסווג", duration_hours: 0.0, comments: "" },
        ],
      },
    ],
  },

  // ─── ציר: שגרה שבועית ─────────────────────────────────────────────────────
  {
    syllabus_name: "שגרה שבועית",
    modules: [
      {
        module_name: "שגרה שבועית",
        events: [
          { name: "ניקיון חדס", duration_hours: 0.5, comments: "שלישי בלילה" },
          {
            name: "סימולציות",
            duration_hours: 5.0,
            comments: "יש חוברת סימולציות של ענף סייבר שממש מומלצת",
          },
          { name: "תזים", duration_hours: 4.5, comments: "15 דקות לכל אחד" },
          {
            name: "אימונים",
            duration_hours: 6.0,
            comments:
              'בפעם הראשונה תיאמנו עם המדאגית שתלמד איך מעבירים אג, אחכ הסגל "מוסמך" ויכול להעביר אגים בעצמו',
          },
          { name: "גיבוש", duration_hours: 10.0, comments: "" },
          {
            name: "שריון חלונות זמן לנבחרות",
            duration_hours: 10.0,
            comments:
              "בקשות שיהיו לנבחרות (למשל תדרוך על שימוש בתוכנות הביס, זמני גיבוש, תדרוך קסם סגל..)",
          },
        ],
      },
    ],
  },

  // ─── ציר: היערכות מבצעית ופתיחת קורס ──────────────────────────────────────
  {
    syllabus_name: "היערכות מבצעית ופתיחת קורס",
    modules: [
      {
        module_name: "היערכות מבצעית",
        events: [
          { name: "מטווחים", duration_hours: 0.0, comments: "" },
          { name: "טקטי", duration_hours: 25.0, comments: "" },
        ],
      },
      {
        module_name: "תדריכי פתיחת קורס",
        events: [
          {
            name: "תדרוך שבוע ראשון",
            duration_hours: 0.45,
            comments: "הסבר איך יתנהל השבוע הראשון, הצגת לוז, תדרוך יום קליטה",
          },
          {
            name: 'תדרוך פ"א 0',
            duration_hours: 0.25,
            comments: 'להכין פתב"ס',
          },
          { name: "תדרוך שבוע ראשון ויום קליטה", duration_hours: 1.0, comments: "" },
          { name: "יום הצגת מקצועות - קורסי", duration_hours: 3.0, comments: "" },
        ],
      },
    ],
  },

  // ─── ציר: קפ"ה (שבועות 3-5) — שמור ────────────────────────────────────────
  // Reserved block. No course events are scheduled here; week 3-5 content was
  // moved into the thematic axes above so this period stays clear.
  {
    syllabus_name: 'קפ"ה (שבועות 3-5) — שמור',
    modules: [
      {
        module_name: 'תקופת קפ"ה — שמור',
        events: [
          {
            name: 'קפ"ה - שבועות 3-5',
            duration_hours: 0.0,
            comments:
              'תקופה שמורה (2026-08-16 .. 2026-09-06). אין לשבץ אירועים בתקופה זו.',
          },
        ],
      },
    ],
  },
];

// -----------------------------------------------------------------------------
// Env reader
// -----------------------------------------------------------------------------

function readEnvFile(path: string): Record<string, string> {
  const result: Record<string, string> = {};
  if (!fs.existsSync(path)) return result;
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) result[match[1].trim()] = match[2].trim();
  }
  return result;
}

// -----------------------------------------------------------------------------
// Seeder
// -----------------------------------------------------------------------------

async function main() {
  const envPath = ".env-mks-srvu";
  const env = readEnvFile(envPath);

  const dbUrl = env["DATABASE_URL"];
  if (!dbUrl) {
    console.error(`[ERROR] DATABASE_URL not found in ${envPath}`);
    process.exit(1);
  }

  console.log(`[INFO] Connecting to: ${dbUrl.replace(/:[^:@]+@/, ":***@")}`);

  const client = new Client({ connectionString: dbUrl, ssl: false });
  await client.connect();
  console.log("[INFO] Connected to PostgreSQL.");

  try {
    // ── 1. Clean previous data ──────────────────────────────────────────────
    // Delete in dependency order (leaves first, roots last).
    // Using CASCADE-safe deletions via junction tables first.
    console.log("[INFO] Cleaning previous Gantt data...");

    // junction: module → event
    await client.query(`DELETE FROM m2e`);
    // junction: syllabus → module
    await client.query(`DELETE FROM s2m`);
    // junction: curriculum → syllabus  (keep curricula, just unlink syllabuses)
    await client.query(`DELETE FROM c2s`);
    // curriculum event configs
    await client.query(`DELETE FROM "cEC"`);
    // curriculum event day mappings
    await client.query(`DELETE FROM "cMDA"`);
    // leaf tables
    await client.query(`DELETE FROM e`);
    await client.query(`DELETE FROM m`);
    await client.query(`DELETE FROM s`);

    console.log("[INFO] Previous data cleared.");

    // ── 2. Insert new data ──────────────────────────────────────────────────
    let syllabusCount = 0;
    let moduleCount = 0;
    let eventCount = 0;

    for (const syllabus of GANTT_DATA) {
      const syllabusId = sid();

      await client.query(
        `INSERT INTO s (id, title, hive_ids, ca, ua)
         VALUES ($1, $2, $3::int[], NOW(), NOW())`,
        [syllabusId, syllabus.syllabus_name, "{}"],
      );
      syllabusCount++;
      console.log(`\n[SYLLABUS] "${syllabus.syllabus_name}" → ${syllabusId}`);

      for (const mod of syllabus.modules) {
        // Each syllabus gets its own module instance — no sharing across syllabuses.
        const moduleId = mid();

        await client.query(
          `INSERT INTO m (id, title, "desc", hive_ids, ca, ua)
           VALUES ($1, $2, $3, $4::int[], NOW(), NOW())`,
          [moduleId, mod.module_name, "", "{}"],
        );
        moduleCount++;

        // Link syllabus → module
        await client.query(
          `INSERT INTO s2m (syllabus_id, module_id) VALUES ($1, $2)`,
          [syllabusId, moduleId],
        );
        console.log(`  [MODULE] "${mod.module_name}" → ${moduleId}`);

        for (const ev of mod.events) {
          const eventId = eid();
          const minDuration = Math.round(ev.duration_hours * 60);

          await client.query(
            `INSERT INTO e (id, title, type, minimum_duration, ca, ua)
             VALUES ($1, $2, $3, $4, NOW(), NOW())`,
            [eventId, ev.name.trim(), "אחר", minDuration],
          );
          eventCount++;

          // Link module → event
          await client.query(
            `INSERT INTO m2e (module_id, event_id) VALUES ($1, $2)`,
            [moduleId, eventId],
          );

          const dur = minDuration > 0 ? `${minDuration}min` : "milestone";
          const note = ev.comments ? ` — ${ev.comments.slice(0, 50)}` : "";
          console.log(`    [EVENT] "${ev.name.trim()}" (${dur})${note}`);
        }
      }
    }

    console.log(
      `\n[SUCCESS] Imported: ${syllabusCount} syllabuses, ${moduleCount} modules, ${eventCount} events.`,
    );
  } finally {
    await client.end();
    console.log("[INFO] Connection closed.");
  }
}

main().catch((err) => {
  console.error("[FATAL]", err);
  process.exit(1);
});
