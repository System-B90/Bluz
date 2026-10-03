/**
 * The one set of words the gantt UI uses for its core concepts (#832).
 *
 * Each term was the one the UI already used most: סילבוס over מקצוע (מקצוע
 * stays for Hive subjects and the אחראי מקצוע role), מערך over מודול (מודול
 * stays for Hive modules), מסלול over קורס (קורס stays for the course as a
 * whole, e.g. "אורך הקורס").
 */
export const GANTT_TERMS = {
    syllabus: "סילבוס",
    syllabuses: "סילבוסים",
    module: "מערך",
    modules: "מערכים",
    event: "מופע",
    events: "מופעים",
    course: "מסלול",
    courses: "מסלולים",
    shuffle: "שאפל",
    shuffles: "שאפלים",
} as const;

export const GANTT_GLOSSARY: ReadonlyArray<{ term: string; meaning: string }> = [
    { term: GANTT_TERMS.syllabus, meaning: "תוכן לימוד אחד בגאנט, עם המערכים והשאפלים שלו" },
    { term: GANTT_TERMS.module, meaning: "יחידה בתוך סילבוס, שמכילה מופעים" },
    { term: GANTT_TERMS.event, meaning: "בלוק למידה אחד באורך מוגדר, שהופך לאירוע בלו\"ז" },
    { term: GANTT_TERMS.course, meaning: "קבוצת חניכים בעץ המסלולים; כל חניך במסלול אחד בכל רמה" },
    { term: GANTT_TERMS.shuffle, meaning: "קבוצת חניכים בתוך סילבוס; כל חניך בשאפל אחד" },
];
