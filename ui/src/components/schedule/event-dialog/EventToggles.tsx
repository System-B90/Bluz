"use client";

import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";
import Typography from "@mui/material/Typography";

import {
    EVENT_FLAGS,
    EventFlagDef,
    eventFlagUpdate,
} from "@/components/schedule/event-flags";
import { Event } from "@/components/schedule/types/event";

/**
 * A selectable chip: icon + label + a compact switch, wrapped in a rounded
 * container that tints to its accent `hue` when active. Each toggle owns a
 * colour + icon so it reads as its own thing. Clicking anywhere on the chip
 * flips it. RTL-safe — no physical left/right props.
 */
function ToggleChip({
    def,
    checked,
    onChange,
}: {
    def: EventFlagDef;
    checked: boolean;
    onChange: (v: boolean) => void;
})
{
    const { label, hue, Icon } = def;

    return (
        <Box
            aria-checked={ checked }
            onClick={ () => onChange(!checked) }
            onKeyDown={ (e) =>
            {
                // role="switch" implies Space/Enter toggle it; a plain Box
                // has neither keyboard focus nor a key handler by default,
                // making the chip mouse-only.
                if (e.key === " " || e.key === "Enter")
                {
                    e.preventDefault();
                    onChange(!checked);
                }
            } }
            role="switch"
            sx={ {
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                cursor: "pointer",
                userSelect: "none",
                px: 1.25,
                py: 0.5,
                borderRadius: 2,
                border: "1px solid",
                borderColor: checked ? hue : "divider",
                backgroundColor: checked ? alpha(hue, 0.12) : "transparent",
                transition: "background-color 180ms, border-color 180ms",
                "&:hover": {
                    backgroundColor: checked
                        ? alpha(hue, 0.18)
                        : "action.hover",
                },
            } }
            tabIndex={ 0 }
        >
            <Icon
                sx={ {
                    fontSize: 18,
                    color: checked ? hue : "text.disabled",
                    transition: "color 180ms",
                } }
            />
            <Typography
                sx={ {
                    fontSize: 13,
                    // Constant weight: switching 500->700 on check reflows the
                    // chip width and visibly nudges the icon. Colour alone
                    // carries the active state.
                    fontWeight: 600,
                    color: checked ? hue : "text.secondary",
                    transition: "color 180ms",
                    whiteSpace: "nowrap",
                } }
            >
                { label }
            </Typography>
        </Box>
    );
}

export function EventToggles({
    event,
    onUpdate,
}: {
    event: Partial<Event>;
    onUpdate: (u: Partial<Event>) => void;
})
{
    return (
        <Box alignItems="center" display="flex" flexWrap="wrap" gap={ 1 }>
            { EVENT_FLAGS.map((def) => (
                <ToggleChip
                    checked={ !!event[ def.key ] }
                    def={ def }
                    key={ def.key }
                    onChange={ (v) => onUpdate(eventFlagUpdate(def.key, v)) }
                />
            )) }
        </Box>
    );
}
