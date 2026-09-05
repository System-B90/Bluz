"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { Dispatch, SetStateAction, useMemo } from "react";

import { APP_ANCHORS, GANTT_ANCHORS } from "@/components/app-onboarding/anchors";
import {
    GANTT_TAB_INDEX,
    waitForTabPaint,
} from "@/components/app-onboarding/gantt/tabs";
import { Tour, useTour } from "@/components/onboarding";

export const GANTT_TOUR_ID = "gantt.intro";

/** Bump to re-show the tour to people who already saw an older version of it. */
const GANTT_TOUR_VERSION = 1;

function Paragraphs({ lines }: { lines: ReadonlyArray<string> }) {
    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {lines.map((line) => (
                <Typography component="p" key={line} variant="body2">
                    {line}
                </Typography>
            ))}
        </Box>
    );
}

/**
 * The first-run walkthrough of the gantt screen (#659).
 *
 * Five concepts, in the order a planner meets them: what a gantt *is*, where
 * the content lives, how weeks bound it, what the preview shows, and what
 * cutting to the schedule does and does not touch. The last one is the reason
 * the tour exists — new users would not risk cutting because nothing told them
 * it neither overwrites nor deletes what is already on the schedule.
 *
 * Registered by the component that owns the tab state, since the tour drives
 * the tabs as it goes.
 */
export function useGanttTour(
    setSelectedTabIndex: Dispatch<SetStateAction<number>>,
) {
    const tour = useMemo<Tour>(
        () => ({
            id: GANTT_TOUR_ID,
            title: "סיור קצר במסך הגאנט",
            version: GANTT_TOUR_VERSION,
            autoStart: true,
            steps: [
                {
                    id: "welcome",
                    title: "ברוכים הבאים לגאנט",
                    placement: "center",
                    body: (
                        <Paragraphs
                            lines={[
                                "הגאנט הוא התכנון של המחזור: מה נלמד, כמה זמן זה לוקח ובאיזה שבוע זה קורה — עוד לפני שיש לו\"ז.",
                                "סיור של דקה על חמשת הדברים שכדאי להכיר. אפשר לצאת בכל רגע, ולחזור אליו דרך כפתור העזרה.",
                            ]}
                        />
                    ),
                },
                {
                    id: "curriculum-fab",
                    title: "בחירת גאנט",
                    anchor: GANTT_ANCHORS.curriculumFab,
                    placement: "inline-start",
                    body: (
                        <Paragraphs
                            lines={[
                                "מכאן בוחרים גאנט קיים או יוצרים חדש, ומכאן גם מגיעים לפעולות עליו — שכפול, סטטוס וגזירה ללו\"ז.",
                            ]}
                        />
                    ),
                },
                {
                    id: "tabs",
                    title: "חמש תצוגות על אותו גאנט",
                    anchor: GANTT_ANCHORS.tabs,
                    placement: "block-end",
                    body: (
                        <Paragraphs
                            lines={[
                                "סילבוסים — התוכן. שבועות — הזמן. רצף זמן — התמונה המלאה. תצוגה מקדימה — איך זה ייראה בלו\"ז. אירועים בטווח — מה נופל בתאריכים מסוימים.",
                                "אלה לא חמישה מסכים שונים אלא חמש זוויות על אותם נתונים.",
                            ]}
                        />
                    ),
                },
                {
                    id: "syllabuses",
                    title: "סילבוסים, מודולים ומופעים",
                    anchor: GANTT_ANCHORS.tabs,
                    placement: "block-end",
                    beforeShow: async () => {
                        setSelectedTabIndex(GANTT_TAB_INDEX.syllabuses);
                        await waitForTabPaint();
                    },
                    body: (
                        <Paragraphs
                            lines={[
                                "סילבוס מכיל מודולים, ומודול מכיל מופעים — בלוק אחד של למידה באורך מוגדר.",
                                "מופע הוא היחידה שתהפוך בסוף לאירוע בלו\"ז. כל עוד הוא כאן, הוא תכנון בלבד.",
                            ]}
                        />
                    ),
                },
                {
                    id: "search",
                    title: "חיפוש בתוך הגאנט",
                    anchor: GANTT_ANCHORS.search,
                    placement: "block-end",
                    optional: true,
                    body: (
                        <Paragraphs
                            lines={[
                                "חיפוש חופשי על כל מה שטעון בגאנט — סילבוס, מודול או מופע — וקפיצה ישירה אליו.",
                                "מי שמעדיף מקלדת: Ctrl+K פותח את שורת הפקודות, שמחפשת את אותם פריטים מכל מסך.",
                            ]}
                        />
                    ),
                },
                {
                    id: "weeks",
                    title: "שבועות ומכסת שעות",
                    anchor: GANTT_ANCHORS.sidebar,
                    placement: "inline-end",
                    optional: true,
                    beforeShow: async () => {
                        setSelectedTabIndex(GANTT_TAB_INDEX.weeks);
                        await waitForTabPaint();
                    },
                    body: (
                        <Paragraphs
                            lines={[
                                "לכל יום ושבוע יש מכסת שעות. הכרטיס הזה מראה כמה שעות כבר שובצו מול כמה יש בפועל.",
                                "אם המספר אדום — התכנון לא נכנס בזמן, וכדאי לטפל בזה לפני הגזירה.",
                            ]}
                        />
                    ),
                },
                {
                    id: "cut-preview",
                    title: "תצוגה מקדימה — לפני שנוגעים בלו\"ז",
                    anchor: GANTT_ANCHORS.tabs,
                    placement: "block-end",
                    beforeShow: async () => {
                        setSelectedTabIndex(GANTT_TAB_INDEX.cutPreview);
                        await waitForTabPaint();
                    },
                    body: (
                        <Paragraphs
                            lines={[
                                "הלשונית הזו מציגה בדיוק איך כל שבוע ייראה בלו\"ז — ולא כותבת כלום.",
                                "זה המקום לבדוק לפני הגזירה: הפסקות, תפילות וחריגות מופיעות כאן בדיוק כמו שהן ייווצרו.",
                            ]}
                        />
                    ),
                },
                {
                    id: "cut",
                    title: "גזירה ללו\"ז — מה באמת קורה",
                    anchor: GANTT_ANCHORS.curriculumFab,
                    placement: "inline-start",
                    interactive: true,
                    body: (
                        <Paragraphs
                            lines={[
                                "גזירה יוצרת אירועים חדשים בלו\"ז. היא לא מוחקת ולא דורסת אירועים קיימים.",
                                "אם הגאנט כבר נגזר, גזירה נוספת פשוט תיחסם — ואי אפשר לגזור גאנט בסטטוס טיוטה.",
                                "וגם אחרי הגזירה זה הפיך: \"משיכה חזרה\" מסירה את מה שהגזירה יצרה, ו\"עדכון הלו\"ז\" מסנכרן אותו לגאנט הנוכחי.",
                            ]}
                        />
                    ),
                },
                {
                    id: "help",
                    title: "וזה תמיד כאן",
                    anchor: APP_ANCHORS.help,
                    placement: "block-end",
                    optional: true,
                    body: (
                        <Paragraphs
                            lines={[
                                "כפתור העזרה פותח את ההסברים האלה בכל רגע, ומאפשר להריץ את הסיור שוב.",
                            ]}
                        />
                    ),
                },
            ],
        }),
        [setSelectedTabIndex],
    );

    useTour(tour);
}
