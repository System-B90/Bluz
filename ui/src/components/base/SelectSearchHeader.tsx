import ListSubheader from "@mui/material/ListSubheader";
import { SelectProps } from "@mui/material/Select";
import TextField from "@mui/material/TextField";
import React from "react";

const NAVIGATION_KEYS = [
    "Escape",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "Home",
    "End",
    "Enter",
    "Tab",
];

const handleSearchEvent = (e: React.KeyboardEvent | React.MouseEvent) => {
    if (e.type === "keydown") {
        const key = (e as React.KeyboardEvent).key;

        if (key === "ArrowDown" || key === "ArrowUp") {
            // MUI's MenuList navigates via `nextElementSibling` off the
            // currently focused element. That works between MenuItems
            // (direct <li> children of the list) but not from the
            // search TextField, which is nested several levels deep -
            // so the first press has to manually hand focus to an
            // actual option before native list traversal can take over.
            // Stopped here, or MenuList would then step off that option too
            // and the first press would skip the first (or last) row.
            e.preventDefault();
            e.stopPropagation();
            const list = (e.currentTarget as HTMLElement).closest("ul");
            const items = list
                ? Array.from(list.querySelectorAll<HTMLElement>("li[tabindex]"))
                : [];
            const target =
                key === "ArrowDown" ? items[0] : items[items.length - 1];
            target?.focus();
            return;
        }

        if (NAVIGATION_KEYS.includes(key)) {
            // Let these bubble up so the Select's menu can handle
            // navigation between options instead of them being trapped
            // by the search field.
            return;
        }
    }
    e.stopPropagation();
};

type SelectSearchHeaderProps = {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
};

/** Sticky search box for the top of a Select menu, with arrow-key hand-off. */
export function SelectSearchHeader({
    value,
    onChange,
    placeholder,
}: SelectSearchHeaderProps) {
    return (
        <ListSubheader
            component="div"
            data-select-search
            onClick={handleSearchEvent}
            onKeyDown={handleSearchEvent}
            onKeyUp={handleSearchEvent}
            sx={{
                p: 1.5,
                position: "sticky",
                top: 0,
                bgcolor: "background.paper",
                zIndex: 2,
                borderBottom: "1px solid",
                borderColor: "divider",
                lineHeight: "normal",
            }}
        >
            <TextField
                autoFocus
                fullWidth
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                size="small"
                value={value}
            />
        </ListSubheader>
    );
}

/**
 * MenuProps for a Select topped by `SelectSearchHeader`: the list scrolls
 * under the sticky search box and the box takes focus once the menu opens.
 */
export function searchableMenuProps(
    menuProps: SelectProps["MenuProps"],
): SelectProps["MenuProps"] {
    return {
        autoFocus: false,
        ...menuProps,
        PaperProps: {
            ...menuProps?.PaperProps,
            sx: {
                maxHeight: 400,
                // The list scrolls instead of the paper, so the
                // scrollbar stays inside the rounded corners.
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                ...menuProps?.PaperProps?.sx,
            },
        },
        MenuListProps: {
            ...menuProps?.MenuListProps,
            sx: {
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                // The sticky search box pins below the list's top
                // padding, which would let rows show above it.
                pt: 0,
                ...menuProps?.MenuListProps?.sx,
            },
        },
        TransitionProps: {
            ...menuProps?.TransitionProps,
            onEntered: (node, ...args) => {
                // The TextField's own `autoFocus` fires on mount, but
                // MUI's Menu focus-traps back to the list right after
                // — this re-focuses the search box once the menu has
                // actually finished opening, after that trap runs.
                node.querySelector<HTMLInputElement>(
                    "[data-select-search] input",
                )?.focus();
                menuProps?.TransitionProps?.onEntered?.(node, ...args);
            },
        },
    };
}
