"use client";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

import { HighlightedText } from "./HighlightedText";
import { ShortcutKeys } from "./KeyChip";
import type { RankedCommand } from "./types";

export type CommandPaletteRowProps = {
    ranked: RankedCommand;
    selected: boolean;
    id: string;
    /** Position in the flattened result list; also the scroll-into-view hook. */
    index: number;
    onHover: () => void;
    onSelect: () => void;
};

/**
 * A single result row.
 *
 * Selection is drawn with a tinted background plus an inline-start accent bar
 * rather than a solid fill, so the match highlighting inside the title stays
 * legible on the selected row too.
 */
export function CommandPaletteRow({
    ranked,
    selected,
    id,
    index,
    onHover,
    onSelect,
}: CommandPaletteRowProps) {
    const { command, titleMatches } = ranked;
    const disabled = command.enabled === false;

    return (
        <Box
            aria-disabled={disabled || undefined}
            aria-selected={selected}
            data-index={index}
            id={id}
            onClick={disabled ? undefined : onSelect}
            onMouseMove={disabled ? undefined : onHover}
            role="option"
            sx={(theme) => ({
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                px: 1.5,
                py: 1,
                mx: 1,
                borderRadius: "10px",
                cursor: disabled ? "default" : "pointer",
                userSelect: "none",
                opacity: disabled ? 0.45 : 1,
                borderInlineStart: "3px solid",
                borderInlineStartColor: selected
                    ? `rgb(${theme.vars.palette.primary.mainChannel} / 0.22)`
                    : "transparent",
                bgcolor: selected
                    ? `rgb(${theme.vars.palette.primary.mainChannel} / 0.12)`
                    : "transparent",
                transition: "background-color 0.12s ease, border-color 0.12s ease",
            })}
        >
            {command.icon ? (
                <Box
                    sx={(theme) => ({
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        width: 32,
                        height: 32,
                        borderRadius: "8px",
                        bgcolor: selected
                            ? `rgb(${theme.vars.palette.primary.mainChannel} / 0.16)`
                            : "action.hover",
                        color: selected ? "primary.main" : "text.secondary",
                        transition: "background-color 0.12s ease, color 0.12s ease",
                        "& svg": { fontSize: 19 },
                    })}
                >
                    {command.icon}
                </Box>
            ) : null}

            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                <Typography
                    noWrap
                    sx={{
                        fontSize: "0.925rem",
                        fontWeight: 600,
                        lineHeight: 1.4,
                        color: "text.primary",
                    }}
                >
                    <HighlightedText
                        indices={titleMatches}
                        text={command.title}
                    />
                </Typography>

                {command.subtitle ? (
                    <Typography
                        noWrap
                        sx={{
                            fontSize: "0.75rem",
                            lineHeight: 1.4,
                            color: "text.secondary",
                        }}
                    >
                        {command.subtitle}
                    </Typography>
                ) : null}
            </Box>

            {command.shortcut?.length ? (
                <ShortcutKeys keys={command.shortcut} />
            ) : null}
        </Box>
    );
}
