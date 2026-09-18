import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import type { ComponentType } from "react";

import { Event } from "@/components/schedule/types/event";

/** The boolean markers a user flips directly on an event. */
export type EventFlagKey =
    | "fake"
    | "hidden"
    | "locked"
    | "personalTalk"
    | "required"
    | "splitAcrossBreaks";

export type EventFlagDef = {
    key: EventFlagKey;
    label: string;
    /** Accent colour the flag is drawn in wherever it appears. */
    hue: string;
    Icon: ComponentType<SvgIconProps>;
};

/**
 * Single source of truth for the event markers, shared by the event dialog's
 * toggle chips and the calendar's right-click "סמן כ…" submenu (#706) — the
 * two must never drift into naming or colouring the same flag differently.
 */
export const EVENT_FLAGS: ReadonlyArray<EventFlagDef> = [
    { key: "locked", label: "מתואם", hue: "#2e7d32", Icon: LockOutlinedIcon },
    { key: "required", label: "קריטי", hue: "#d32f2f", Icon: PriorityHighIcon },
    {
        key: "personalTalk",
        label: 'חלון פ"א',
        hue: "#0288d1",
        Icon: RecordVoiceOverIcon,
    },
    { key: "hidden", label: "מוסתר", hue: "#616161", Icon: VisibilityOffIcon },
    {
        key: "splitAcrossBreaks",
        label: "פיצול סביב הפסקות",
        hue: "#ef6c00",
        Icon: CallSplitIcon,
    },
    { key: "fake", label: "פיקטיבי", hue: "#7b1fa2", Icon: AutoFixHighIcon },
];

/**
 * The patch that setting `key` to `value` implies. Turning "פיקטיבי" on also
 * detaches the event from Hive (#102): a fake event carries no subject,
 * module or lesson, so the flag is never a plain one-field write.
 * @param key The flag being set.
 * @param value Its new value.
 * @returns The fields to merge into the event.
 */
export function eventFlagUpdate(
    key: EventFlagKey,
    value: boolean,
): Partial<Event> {
    if (key === "fake" && value) {
        return { fake: true, subject: 0, hiveModule: 0, hiveLesson: null };
    }
    return { [key]: value } as Partial<Event>;
}
