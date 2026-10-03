"use client";
import Typography from "@mui/material/Typography";
import { HelpTopic, useHelpTopics } from "@system-b90/onboarding";
import { useMemo } from "react";

import { GANTT_TOUR_ID } from "@/components/app-onboarding/gantt/use-gantt-tour";
import { HELP_GROUPS } from "@/components/app-onboarding/labels";
import { GANTT_GLOSSARY } from "@/components/gantt/glossary";

function Body({ children }: { children: React.ReactNode }) {
    return (
        <Typography component="span" variant="body2">
            {children}
        </Typography>
    );
}

/**
 * The returning-user half of #659: the same concepts as the tour, readable at
 * any time from the "?" panel, without a spotlight chasing the screen.
 *
 * Deliberately the same five concepts and the same claims as `useGanttTour` —
 * two explanations of the cut that drift apart is worse than one.
 */
export function useGanttHelpTopics() {
    const topics = useMemo<ReadonlyArray<HelpTopic>>(
        () => [
            {
                id: "gantt.what",
                group: HELP_GROUPS.gantt,
                title: "מה זה בכלל גאנט?",
                tourId: GANTT_TOUR_ID,
                body: (
                    <Body>
                        התכנון של המחזור: מה נלמד, כמה זמן זה לוקח ובאיזה שבוע
                        זה קורה. הגאנט הוא לא הלו&quot;ז — הוא מה שהלו&quot;ז
                        ייגזר ממנו.
                    </Body>
                ),
            },
            {
                id: "gantt.content",
                group: HELP_GROUPS.gantt,
                title: "סילבוס, מערך, מופע",
                body: (
                    <Body>
                        סילבוס מכיל מערכים, ומערך מכיל מופעים. מופע הוא בלוק
                        למידה אחד באורך מוגדר, והיחידה שתהפוך בסוף לאירוע
                        בלו&quot;ז.
                    </Body>
                ),
            },
            {
                // The words the UI uses, exactly (#832). Keep in step with GANTT_GLOSSARY.
                id: "gantt.glossary",
                group: HELP_GROUPS.gantt,
                title: "מילון מונחים",
                body: (
                    <Body>
                        { GANTT_GLOSSARY.map(({ term, meaning }) => `${term} — ${meaning}`).join(". ") }.
                    </Body>
                ),
            },
            {
                id: "gantt.weeks",
                group: HELP_GROUPS.gantt,
                title: "שבועות ומכסת שעות",
                body: (
                    <Body>
                        לכל יום ושבוע מכסת שעות. לשונית &quot;שבועות&quot;
                        וכרטיס השעות בצד מראים כמה כבר שובץ מול כמה יש. חריגה
                        מסומנת לפני הגזירה, לא אחריה.
                    </Body>
                ),
            },
            {
                id: "gantt.cut",
                group: HELP_GROUPS.gantt,
                title: 'גזירה ללו"ז — ומה קורה לאירועים קיימים',
                tourId: GANTT_TOUR_ID,
                body: (
                    <Body>
                        גזירה רק יוצרת אירועים חדשים — היא לא מוחקת ולא דורסת
                        אירועים שכבר בלו&quot;ז. גאנט שכבר נגזר ייחסם מגזירה
                        נוספת, וגאנט בסטטוס טיוטה לא ניתן לגזירה כלל.
                    </Body>
                ),
            },
            {
                id: "gantt.cut-undo",
                group: HELP_GROUPS.gantt,
                title: 'משיכה חזרה ועדכון הלו"ז',
                body: (
                    <Body>
                        &quot;משיכה חזרה&quot; מסירה את מה שהגזירה יצרה,
                        ו&quot;עדכון הלו&quot;ז&quot; מסנכרן את הלו&quot;ז
                        לגאנט הנוכחי. כלומר גזירה היא צעד הפיך.
                    </Body>
                ),
            },
        ],
        [],
    );

    useHelpTopics(topics);
}
