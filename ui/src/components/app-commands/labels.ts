import { withLabelOverrides } from "@system-b90/command-palette";
import { HE_LABELS } from "@system-b90/command-palette/he";

/**
 * Bluz's palette wording.
 *
 * Starts from the package's Hebrew table and overrides only what Bluz says
 * differently — most of it a matter of house voice, plus a placeholder that
 * names the things this app actually holds. Importing `/he` and never `/en` is
 * what keeps the English strings out of the bundle.
 */
export const PALETTE_LABELS = withLabelOverrides(HE_LABELS, {
    placeholder: "הקלידו פקודה, או חפשו סילבוס, חדר, גאנט…",
    empty: "לא נמצאו תוצאות",
    recents: "בשימוש לאחרונה",
    kinds: {
        entity: "פריטים",
        goto: "ניווט",
    },
    hints: {
        run: "ביצוע",
    },
});

/**
 * Section headings. Centralised so two contributors never disagree on the
 * spelling of a group and split it into two sections in the result list.
 */
export const COMMAND_GROUPS = {
    navigation: "ניווט",
    schedule: "לוח זמנים",
    gantt: "גאנט",
    settings: "הגדרות",
    appearance: "תצוגה",
    rooms: "חדרים",
    outsiders: "אנשי חוץ",
    account: "חשבון",
} as const;
