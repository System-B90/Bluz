"use client";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Dialog from "@mui/material/Dialog";
import InputBase from "@mui/material/InputBase";
import Typography from "@mui/material/Typography";
import {
    KeyboardEvent as ReactKeyboardEvent,
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react";

import { useCommandPaletteContext } from "./CommandPaletteContext";
import { CommandPaletteRow } from "./CommandPaletteRow";
import { parseQuery } from "./core/modes";
import { flattenGroups, groupRanked, rankCommands } from "./core/rank";
import type { RankedCommand } from "./types";

export type CommandPaletteDialogProps = {
    width?: number;
};

/** Move `from` by `step`, skipping disabled rows, without wrapping past the ends. */
function nextSelectable(
    items: Array<RankedCommand>,
    from: number,
    step: number,
): number {
    for (let i = from + step; i >= 0 && i < items.length; i += step) {
        if (items[i].command.enabled !== false) return i;
    }
    return from;
}

function firstSelectable(items: Array<RankedCommand>): number {
    const index = items.findIndex((item) => item.command.enabled !== false);
    return index === -1 ? 0 : index;
}

/**
 * The palette sheet: a top-anchored dialog holding a borderless query field and
 * a grouped result list.
 *
 * Rendered by `CommandPaletteProvider` — host apps do not mount this directly.
 */
export function CommandPaletteDialog({
    width = 640,
}: CommandPaletteDialogProps) {
    const { registry, recents, labels, isOpen, rawQuery, setRawQuery, close } =
        useCommandPaletteContext();

    const listboxId = useId();
    const listRef = useRef<HTMLDivElement | null>(null);
    const [selected, setSelected] = useState(0);

    // The registry mutates in place, so a version counter is the only signal
    // that its contents changed.
    const [version, setVersion] = useState(0);
    useEffect(
        () => registry.subscribe(() => setVersion((current) => current + 1)),
        [registry],
    );

    const query = useMemo(() => parseQuery(rawQuery), [rawQuery]);

    const groups = useMemo(() => {
        void version;
        if (!isOpen) return [];

        const ranked = rankCommands(registry.collect(query), query, {
            recents,
        });

        // With nothing typed, surface the user's habits explicitly instead of
        // letting recency silently reorder an otherwise arbitrary list.
        if (!query.text) {
            const recentIds = new Set(recents.ids());
            return groupRanked(
                ranked.map((item) =>
                    recentIds.has(item.command.id)
                        ? {
                            ...item,
                            command: {
                                ...item.command,
                                group: labels.recents,
                            },
                        }
                        : item,
                ),
            );
        }

        return groupRanked(ranked);
    }, [isOpen, registry, recents, query, labels.recents, version]);

    const items = useMemo(() => flattenGroups(groups), [groups]);

    // Rows carry their position in the flattened list, which is what selection
    // and `aria-activedescendant` are indexed by.
    const indexedGroups = useMemo(() => {
        let index = 0;
        return groups.map((group) => ({
            group: group.group,
            items: group.items.map((ranked) => ({ ranked, index: index++ })),
        }));
    }, [groups]);

    // Any change to the result set restarts selection at the top match.
    const [previousItems, setPreviousItems] = useState(items);
    if (previousItems !== items) {
        setPreviousItems(items);
        setSelected(firstSelectable(items));
    }

    useEffect(() => {
        if (!isOpen) return;
        const element = listRef.current?.querySelector(
            `[data-index="${selected}"]`,
        );
        element?.scrollIntoView({ block: "nearest" });
    }, [selected, isOpen]);

    const runCommand = useCallback(
        (ranked: RankedCommand | undefined) => {
            if (!ranked || ranked.command.enabled === false) return;

            recents.record(ranked.command.id);
            if (!ranked.command.keepOpen) close();
            void ranked.command.run();
        },
        [recents, close],
    );

    const onKeyDown = useCallback(
        (event: ReactKeyboardEvent) => {
            switch (event.key) {
            case "ArrowDown":
                event.preventDefault();
                setSelected((current) =>
                    nextSelectable(items, current, 1),
                );
                break;
            case "ArrowUp":
                event.preventDefault();
                setSelected((current) =>
                    nextSelectable(items, current, -1),
                );
                break;
            case "Home":
                event.preventDefault();
                setSelected(firstSelectable(items));
                break;
            case "End":
                event.preventDefault();
                setSelected(nextSelectable(items, items.length, -1));
                break;
            case "Enter":
                event.preventDefault();
                runCommand(items[selected]);
                break;
            default:
                break;
            }
        },
        [items, selected, runCommand],
    );

    return (
        <Dialog
            fullWidth
            onClose={close}
            open={isOpen}
            slotProps={{
                paper: {
                    sx: {
                        width,
                        maxWidth: "calc(100vw - 32px)",
                        mt: "12vh",
                        mb: 2,
                        borderRadius: "16px",
                        overflow: "hidden",
                        bgcolor: "background.paper",
                        backgroundImage: "none",
                        boxShadow: "0 24px 50px rgba(0,0,0,0.25)",
                    },
                },
                backdrop: {
                    sx: { backdropFilter: "blur(2px)" },
                },
            }}
            sx={{
                "& .MuiDialog-container": { alignItems: "flex-start" },
            }}
            transitionDuration={150}
        >
            {/* Query field */}
            <Box
                sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 2,
                    py: 1.5,
                    borderBottom: "1px solid",
                    borderColor: "divider",
                }}
            >
                <SearchIcon sx={{ color: "text.secondary", fontSize: 22 }} />

                {query.kind ? (
                    <Chip
                        color="primary"
                        label={labels.kinds[query.kind]}
                        size="small"
                        sx={{ fontWeight: 700 }}
                    />
                ) : null}

                <InputBase
                    autoFocus
                    fullWidth
                    inputProps={{
                        "aria-activedescendant":
                            items.length > 0
                                ? `${listboxId}-option-${selected}`
                                : undefined,
                        "aria-controls": listboxId,
                        "aria-expanded": true,
                        "aria-label": labels.placeholder,
                        role: "combobox",
                        // Latin prefixes stay left-anchored while Hebrew input
                        // still lays out right-to-left.
                        dir: "auto",
                    }}
                    onChange={(event) => setRawQuery(event.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={labels.placeholder}
                    sx={{ fontSize: "1.05rem" }}
                    value={rawQuery}
                />
            </Box>

            {/* Results */}
            <Box
                aria-label={labels.placeholder}
                id={listboxId}
                ref={listRef}
                role="listbox"
                sx={{
                    maxHeight: "min(50vh, 420px)",
                    overflowY: "auto",
                    py: 1,
                }}
            >
                {items.length === 0 ? (
                    <Typography
                        sx={{
                            px: 3,
                            py: 4,
                            textAlign: "center",
                            color: "text.secondary",
                            fontSize: "0.9rem",
                        }}
                    >
                        {labels.empty}
                    </Typography>
                ) : null}

                {indexedGroups.map((group) => (
                    <Box
                        aria-label={group.group || undefined}
                        key={group.group || "__ungrouped__"}
                        role="group"
                    >
                        {group.group ? (
                            <Typography
                                aria-hidden
                                sx={{
                                    px: 3,
                                    pt: 1.5,
                                    pb: 0.5,
                                    fontSize: "0.7rem",
                                    fontWeight: 700,
                                    letterSpacing: "0.04em",
                                    color: "text.secondary",
                                }}
                            >
                                {group.group}
                            </Typography>
                        ) : null}

                        {group.items.map(({ ranked, index }) => (
                            <CommandPaletteRow
                                id={`${listboxId}-option-${index}`}
                                index={index}
                                key={ranked.command.id}
                                onHover={() => setSelected(index)}
                                onSelect={() => runCommand(ranked)}
                                ranked={ranked}
                                selected={index === selected}
                            />
                        ))}
                    </Box>
                ))}
            </Box>

            {/* Hint bar */}
            <Box
                sx={{
                    display: "flex",
                    gap: 2,
                    px: 2,
                    py: 1,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    bgcolor: "action.hover",
                    fontSize: "0.72rem",
                    color: "text.secondary",
                    flexWrap: "wrap",
                }}
            >
                <span>↑↓ {labels.hints.navigate}</span>
                <span>Enter {labels.hints.run}</span>
                <span>Esc {labels.hints.close}</span>
            </Box>
        </Dialog>
    );
}
