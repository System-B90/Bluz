import type { CommandPaletteLabels } from "@/components/command-palette";

/**
 * Every string the palette renders. The package itself ships no copy, so this
 * is the single place Bluz's palette wording lives.
 */
export const PALETTE_LABELS: CommandPaletteLabels = {
    placeholder: "הקלידו פקודה, או חפשו סילבוס, חדר, גאנט…",
    empty: "לא נמצאו תוצאות",
    recents: "בשימוש לאחרונה",
    kinds: {
        command: "פקודות",
        entity: "פריטים",
        goto: "ניווט",
    },
    hints: {
        navigate: "ניווט",
        run: "ביצוע",
        close: "סגירה",
    },
};

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
} as const;
