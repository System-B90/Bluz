import { alpha, Theme } from "@mui/material/styles";

/**
 * `sx` that briefly flashes a row's sticky label cell when its `data-gantt-flash`
 * attribute is present. Used to draw the eye after scrolling to an item (from the
 * unallocated panel). Toggle the attribute imperatively to (re)trigger it.
 */
export function getFlashRowSx(theme: Theme) {
    return {
        "&[data-gantt-flash] > td:first-of-type": {
            animation: "ganttFlash 1.5s ease-out",
        },
        "@keyframes ganttFlash": {
            "0%": {
                backgroundColor: alpha(theme.palette.primary.main, 0.35),
            },
            "100%": { backgroundColor: "transparent" },
        },
    };
}
