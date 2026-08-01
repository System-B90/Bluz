/** Shared `sx` fragments for the calendar toolbar / overlay control buttons. */

/** Tint on hover, shrink on press — the base every control button uses. */
export const CONTROL_BUTTON_SX = {
    transition: "all 0.2s ease-in-out",
    "&:hover": { color: "primary.main" },
    "&:active": { transform: "scale(0.95)" },
} as const;

/** {@link CONTROL_BUTTON_SX} plus the pulsing icon used by the fullscreen toggles. */
export const PULSING_ICON_BUTTON_SX = {
    ...CONTROL_BUTTON_SX,
    "&:hover .MuiSvgIcon-root": {
        animation: "pulse-expand 1.2s infinite ease-in-out",
    },
    "@keyframes pulse-expand": {
        "0%, 100%": { transform: "scale(1)" },
        "50%": { transform: "scale(1.25)" },
    },
} as const;

/** Control button that also grows slightly on hover (toolbar visibility toggle). */
export const GROWING_CONTROL_BUTTON_SX = {
    ...CONTROL_BUTTON_SX,
    "&:hover": { transform: "scale(1.15)", color: "primary.main" },
} as const;
