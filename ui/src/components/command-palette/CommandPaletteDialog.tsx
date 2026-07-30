"use client";
import SearchIcon from "@mui/icons-material/Search";
import SearchOffIcon from "@mui/icons-material/SearchOff";
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
import { buildRawQuery, parseQuery } from "./core/modes";
import { flattenGroups, groupRanked, rankCommands } from "./core/rank";
import { ShortcutKeys } from "./KeyChip";
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

/** One `keys — label` pair in the footer. */
function Hint({ keys, label }: { keys: Array<string>; label: string }) {
    return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.625 }}>
            <ShortcutKeys keys={keys} />
            <span>{label}</span>
        </Box>
    );
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
    const inputRef = useRef<HTMLInputElement | null>(null);
    const [selected, setSelected] = useState(0);

    // The dialog's own focus management runs after mount and can steal focus
    // from `autoFocus` on the input, so grab it explicitly once open instead.
    useEffect(() => {
        if (isOpen) inputRef.current?.focus();
    }, [isOpen]);

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
            case "Backspace":
                // The lane prefix lives in the chip rather than in the field,
                // so backspacing out of an empty field has to clear it.
                if (query.kind && query.text === "") {
                    event.preventDefault();
                    setRawQuery("");
                }
                break;
            default:
                break;
            }
        },
        [items, selected, runCommand, query, setRawQuery],
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
                        borderRadius: "14px",
                        overflow: "hidden",
                        border: "1px solid",
                        borderColor: "divider",
                        bgcolor: "background.paper",
                        backgroundImage: "none",
                        boxShadow: "0 24px 64px rgba(0,0,0,0.32)",
                    },
                },
                backdrop: {
                    sx: { backdropFilter: "blur(3px)" },
                },
                // The dialog's focus trap moves focus to the paper once the
                // transition ends, which lands after both `autoFocus` and the
                // open effect — so grab the field back here, after it has had
                // its say. Without this the palette opens unfocused when it was
                // opened by click (the trigger button keeps focus).
                transition: {
                    onEntered: () => inputRef.current?.focus(),
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
                <SearchIcon
                    sx={{
                        flexShrink: 0,
                        fontSize: 22,
                        color: query.text ? "primary.main" : "text.secondary",
                        transition: "color 0.12s ease",
                    }}
                />

                {query.kind ? (
                    <Chip
                        color="primary"
                        label={labels.kinds[query.kind]}
                        onDelete={() => setRawQuery(query.text)}
                        size="small"
                        sx={{ flexShrink: 0, fontWeight: 700 }}
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
                    }}
                    inputRef={inputRef}
                    onChange={(event) =>
                        setRawQuery(
                            buildRawQuery(query.kind, event.target.value),
                        )
                    }
                    onKeyDown={onKeyDown}
                    placeholder={labels.placeholder}
                    sx={{
                        fontSize: "1.05rem",
                        "& input::placeholder": { opacity: 0.7 },
                    }}
                    // The lane prefix is rendered as the chip beside the field,
                    // so it is kept out of the visible text. Keeping an ASCII
                    // prefix in an RTL field would otherwise leave it stranded
                    // at the wrong visual end of the query.
                    value={query.kind ? query.text : rawQuery}
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
                    overscrollBehavior: "contain",
                    scrollbarWidth: "thin",
                }}
            >
                {items.length === 0 ? (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1,
                            px: 3,
                            py: 5,
                            color: "text.secondary",
                        }}
                    >
                        <SearchOffIcon sx={{ fontSize: 30, opacity: 0.6 }} />
                        <Typography sx={{ fontSize: "0.9rem" }}>
                            {labels.empty}
                        </Typography>
                    </Box>
                ) : null}

                {indexedGroups.map((group, groupIndex) => (
                    <Box
                        aria-label={group.group || undefined}
                        key={group.group || "__ungrouped__"}
                        role="group"
                        sx={
                            groupIndex > 0
                                ? {
                                    mt: 0.75,
                                    pt: 0.75,
                                    borderTop: "1px solid",
                                    borderColor: "divider",
                                }
                                : undefined
                        }
                    >
                        {group.group ? (
                            <Typography
                                aria-hidden
                                sx={{
                                    px: 2.5,
                                    pt: 0.75,
                                    pb: 0.5,
                                    fontSize: "0.68rem",
                                    fontWeight: 700,
                                    letterSpacing: "0.06em",
                                    textTransform: "uppercase",
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
                    alignItems: "center",
                    gap: 2,
                    px: 2,
                    py: 0.875,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    bgcolor: "action.hover",
                    fontSize: "0.72rem",
                    color: "text.secondary",
                    flexWrap: "wrap",
                }}
            >
                {/* Each hint keeps the ambient direction so the keycaps sit on
                    the reading-start side of their label. */}
                <Hint keys={["↑", "↓"]} label={labels.hints.navigate} />
                <Hint keys={["Enter"]} label={labels.hints.run} />
                <Hint keys={["Esc"]} label={labels.hints.close} />
            </Box>
        </Dialog>
    );
}
