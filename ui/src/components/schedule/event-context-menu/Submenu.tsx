"use client";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem, { MenuItemProps } from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
    KeyboardEvent as ReactKeyboardEvent,
    MouseEvent as ReactMouseEvent,
    ReactNode,
    useCallback,
    useMemo,
    useState,
} from "react";

/**
 * Nested menus are portalled `Menu`s anchored to their parent item rather than
 * MUI's own (v7 has no submenu primitive). Opening to the physical *left* of
 * the parent is the RTL-correct direction: the root menu sits at the pointer
 * and the submenu unfolds away from the page's start edge.
 */
const SUBMENU_ANCHOR_ORIGIN = { vertical: "top", horizontal: "left" } as const;
const SUBMENU_TRANSFORM_ORIGIN = {
    vertical: "top",
    horizontal: "right",
} as const;

/** Above this many options the picker is unusable without a filter box. */
const SEARCH_THRESHOLD = 8;

/**
 * Anything the parent `MenuList` injects into what it believes is a plain
 * menu item — `ref`, `tabIndex`, `autoFocus` — plus the submenu's own props.
 * Forwarding the injected set is what keeps the entry reachable by keyboard:
 * MenuList focuses items through the ref it hands down, and a component that
 * swallows it drops out of the arrow-key walk entirely.
 */
export type SubmenuProps = {
    label: string;
    icon: ReactNode;
    /** Rendered inside the nested menu. */
    children: ReactNode;
} & Omit<MenuItemProps, "children" | "onClick">;

export function Submenu({
    label,
    icon,
    children,
    ...menuItemProps
}: SubmenuProps) {
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

    const open = useCallback(
        (pointer: ReactMouseEvent<HTMLElement>) =>
            setAnchorEl(pointer.currentTarget),
        [],
    );

    return (
        <>
            <MenuItem {...menuItemProps} onClick={open}>
                <ListItemIcon>{icon}</ListItemIcon>
                <ListItemText>{label}</ListItemText>
                {/* Points at the physical left, where the submenu opens. */}
                <ChevronLeftIcon
                    fontSize="small"
                    sx={{ opacity: 0.5, marginInlineStart: 1 }}
                />
            </MenuItem>
            <Menu
                anchorEl={anchorEl}
                anchorOrigin={SUBMENU_ANCHOR_ORIGIN}
                disableAutoFocusItem
                onClose={() => setAnchorEl(null)}
                open={anchorEl !== null}
                slotProps={{ paper: { sx: { maxHeight: 380, minWidth: 220 } } }}
                transformOrigin={SUBMENU_TRANSFORM_ORIGIN}
            >
                {children}
            </Menu>
        </>
    );
}

export type PickerOption = {
    id: string;
    label: string;
};

export type PickerSubmenuProps = {
    label: string;
    icon: ReactNode;
    options: ReadonlyArray<PickerOption>;
    /** Entry that unassigns instead of picking. Omitted when not meaningful. */
    clearLabel?: string;
    emptyLabel?: string;
    onPick: (id: null | string) => void;
} & Omit<MenuItemProps, "children" | "onClick">;

/**
 * A submenu that picks one option out of a list, with a filter box once the
 * list outgrows a glance. The list is data, not markup, so the same component
 * serves rooms and instructors.
 */
export function PickerSubmenu({
    label,
    icon,
    options,
    clearLabel,
    emptyLabel = "אין אפשרויות",
    onPick,
    ...menuItemProps
}: PickerSubmenuProps) {
    const [query, setQuery] = useState("");

    const filtered = useMemo(() => {
        const needle = query.trim().toLowerCase();
        if (!needle) return options;
        return options.filter((option) =>
            option.label.toLowerCase().includes(needle),
        );
    }, [options, query]);

    // The menu's own type-ahead would swallow every keystroke aimed at the
    // filter box, and Backspace/arrows would move the highlight instead of the
    // caret. Escape still has to reach the menu so it can close.
    const keepKeysInTheField = useCallback((keyboard: ReactKeyboardEvent) => {
        if (keyboard.key !== "Escape") keyboard.stopPropagation();
    }, []);

    const showSearch = options.length > SEARCH_THRESHOLD;

    return (
        <Submenu {...menuItemProps} icon={icon} label={label}>
            {showSearch ? (
                <Box sx={{ px: 1.5, pb: 1, pt: 0.5 }}>
                    <TextField
                        autoFocus
                        fullWidth
                        onChange={(change) => setQuery(change.target.value)}
                        onKeyDown={keepKeysInTheField}
                        placeholder="חיפוש…"
                        size="small"
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <SearchIcon fontSize="small" />
                                    </InputAdornment>
                                ),
                            },
                        }}
                        value={query}
                    />
                </Box>
            ) : null}

            {clearLabel ? (
                <MenuItem onClick={() => onPick(null)}>
                    <ListItemText
                        slotProps={{ primary: { sx: { fontStyle: "italic" } } }}
                    >
                        {clearLabel}
                    </ListItemText>
                </MenuItem>
            ) : null}
            {clearLabel && filtered.length > 0 ? <Divider /> : null}

            {filtered.length === 0 ? (
                <Typography
                    sx={{ px: 2, py: 1, color: "text.secondary" }}
                    variant="body2"
                >
                    {emptyLabel}
                </Typography>
            ) : (
                filtered.map((option) => (
                    <MenuItem key={option.id} onClick={() => onPick(option.id)}>
                        <ListItemText>{option.label}</ListItemText>
                    </MenuItem>
                ))
            )}
        </Submenu>
    );
}
