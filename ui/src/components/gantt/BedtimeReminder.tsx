"use client";

import BedtimeIcon from "@mui/icons-material/Bedtime";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Snackbar from "@mui/material/Snackbar";
import { useCallback, useEffect, useState } from "react";

/** Local hour from which the reminders start (inclusive). */
const BEDTIME_HOUR = 23;
/** Local hour at which the night ends and the reminders stop. */
const MORNING_HOUR = 5;
const CHECK_INTERVAL_MS = 60 * 1000;
/** Time between a dismissed reminder and the next one. */
const SNOOZE_MS = 30 * 60 * 1000;

const MESSAGES = [
    "כבר אחרי 23:00 🌙 הגאנט יחכה לך מחר, הגוף שלך צריך שינה.",
    "שינה טובה = החלטות טובות. אולי הגיע הזמן לסגור להיום? 😴",
    "המערכת עובדת מצוין גם בלעדיך בלילה. לך/י לישון, נתראה בבוקר ☀️",
    "תזכורת ידידותית: מנוחה היא חלק מהעבודה. לילה טוב! 💤",
    "עייפות מובילה לטעויות בשיבוץ. שינה עכשיו תחסוך תיקונים מחר 🛌",
];

function isLateNight(date: Date): boolean {
    const hour = date.getHours();
    return hour >= BEDTIME_HOUR || hour < MORNING_HOUR;
}

/**
 * Friendly nudge to go to sleep when the Gantt page is in use late at night.
 * Checks the local clock every minute while the tab is visible; after the
 * user dismisses a reminder, the next one waits {@link SNOOZE_MS}.
 */
export function BedtimeReminder() {
    const [messageIndex, setMessageIndex] = useState<null | number>(null);
    const [nextAllowedAt, setNextAllowedAt] = useState(0);

    useEffect(() => {
        const check = () => {
            if (document.visibilityState !== "visible") return;
            const now = new Date();
            if (!isLateNight(now) || now.getTime() < nextAllowedAt) return;
            setMessageIndex((prev) =>
                prev ?? Math.floor(Math.random() * MESSAGES.length),
            );
        };

        check();
        const interval = setInterval(check, CHECK_INTERVAL_MS);
        document.addEventListener("visibilitychange", check);
        return () => {
            clearInterval(interval);
            document.removeEventListener("visibilitychange", check);
        };
    }, [nextAllowedAt]);

    const dismiss = useCallback(() => {
        setMessageIndex(null);
        setNextAllowedAt(Date.now() + SNOOZE_MS);
    }, []);

    return (
        <Snackbar
            anchorOrigin={{ horizontal: "center", vertical: "top" }}
            onClose={(_event, reason) => {
                if (reason !== "clickaway") dismiss();
            }}
            open={messageIndex !== null}
        >
            <Alert
                action={
                    <Button color="inherit" onClick={dismiss} size="small">
                        עוד קצת
                    </Button>
                }
                icon={<BedtimeIcon />}
                severity="info"
                sx={{ alignItems: "center", fontWeight: 500 }}
                variant="filled"
            >
                {messageIndex !== null ? MESSAGES[messageIndex] : null}
            </Alert>
        </Snackbar>
    );
}
