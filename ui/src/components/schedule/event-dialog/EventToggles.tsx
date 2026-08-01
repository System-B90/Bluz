"use client";

import AutoFixHighIcon from "@mui/icons-material/AutoFixHigh";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import PriorityHighIcon from "@mui/icons-material/PriorityHigh";
import RecordVoiceOverIcon from "@mui/icons-material/RecordVoiceOver";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Box from "@mui/material/Box";
import { alpha } from "@mui/material/styles";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import Typography from "@mui/material/Typography";
import type { ComponentType } from "react";

import { Event } from "@/components/schedule/types/event";

type ToggleDef = {
    label: string;
    key: keyof Event;
    hue: string;
    Icon: ComponentType<SvgIconProps>;
};

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
    def: ToggleDef;
    checked: boolean;
    onChange: (v: boolean) => void;
})
{
    const { label, hue, Icon } = def;

    return (
        <Box
            aria-checked={ checked }
            onClick={ () => onChange(!checked) }
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
    const toggles: Array<ToggleDef> = [
        { label: "מתואם", key: "locked", hue: "#2e7d32", Icon: LockOutlinedIcon },
        { label: "קריטי", key: "required", hue: "#d32f2f", Icon: PriorityHighIcon },
        {
            label: 'חלון פ"א',
            key: "personalTalk",
            hue: "#0288d1",
            Icon: RecordVoiceOverIcon,
        },
        { label: "מוסתר", key: "hidden", hue: "#616161", Icon: VisibilityOffIcon },
        {
            label: "פיצול הפסקות",
            key: "splitAcrossBreaks",
            hue: "#ef6c00",
            Icon: CallSplitIcon,
        },
    ];

    return (
        <Box alignItems="center" display="flex" flexWrap="wrap" gap={ 1 }>
            { toggles.map((def) => (
                <ToggleChip
                    checked={ !!event[ def.key ] }
                    def={ def }
                    key={ def.key }
                    onChange={ (v) => onUpdate({ [ def.key ]: v }) }
                />
            )) }
            <ToggleChip
                checked={ !!event.fake }
                def={ {
                    label: "פיקטיבי",
                    key: "fake",
                    hue: "#7b1fa2",
                    Icon: AutoFixHighIcon,
                } }
                onChange={ (v) =>
                    // Fake events are detached from Hive: clear the
                    // subject/module/lesson wiring when toggled on.
                    onUpdate(
                        v
                            ? {
                                fake: true,
                                subject: 0,
                                hiveModule: 0,
                                hiveLesson: null,
                            }
                            : { fake: false },
                    )
                }
            />
        </Box>
    );
}
