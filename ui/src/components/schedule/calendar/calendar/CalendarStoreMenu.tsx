import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { ReactNode, useCallback, useState } from "react";

/** One icon action rendered on the trailing edge of a stored-entry row. */
export type StoreEntryAction<TEntry> = {
    tooltip: string;
    icon: ReactNode;
    color?: "error";
    /** `close` dismisses the popover — call it after a state-replacing action. */
    onClick: (entry: TEntry, close: () => void) => void;
};

export type CalendarStoreMenuProps<TEntry extends { id: string }> = {
    /** Tooltip on the toolbar button. */
    tooltip: string;
    /** Icon inside the toolbar button. */
    icon: ReactNode;
    /** Popover heading. */
    title: string;
    /** Label of the "new entry name" text field. */
    nameLabel: string;
    /** Label of the create button. */
    createLabel: string;
    /** Icon of the create button. */
    createIcon: ReactNode;
    /** Text shown when the store holds no entries. */
    emptyText: string;
    entries: Array<TEntry>;
    loading: boolean;
    /** Non-null while one entry is mutating; disables all row actions. */
    busyId: null | string;
    /** Fetch the entry list. Called whenever the popover opens. */
    onRefresh: () => Promise<void> | void;
    /** Create a new entry from the current calendar under the given name. */
    onCreate: (label: string) => Promise<void> | void;
    /** Primary and secondary text for one row. */
    renderEntry: (entry: TEntry) => { primary: string; secondary: string };
    actions: Array<StoreEntryAction<TEntry>>;
    /** Extra nodes rendered next to the popover (e.g. confirmation dialogs). */
    children?: ReactNode;
};

/**
 * Toolbar popover shared by the shared-drafts and snapshots menus: a named
 * create field over a list of stored calendar states, each row exposing the
 * same disabled-while-busy icon actions. Owners keep the data + API calls.
 */
export function CalendarStoreMenu<TEntry extends { id: string }>({
    tooltip,
    icon,
    title,
    nameLabel,
    createLabel,
    createIcon,
    emptyText,
    entries,
    loading,
    busyId,
    onRefresh,
    onCreate,
    renderEntry,
    actions,
    children,
}: CalendarStoreMenuProps<TEntry>) {
    const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
    const [label, setLabel] = useState("");

    const handleClose = useCallback(() => setAnchorEl(null), []);

    const handleOpen = useCallback(
        (e: React.MouseEvent<HTMLButtonElement>) => {
            setAnchorEl(e.currentTarget);
            void onRefresh();
        },
        [onRefresh],
    );

    const handleCreate = useCallback(async () => {
        const trimmed = label.trim();
        if (!trimmed) return;
        await onCreate(trimmed);
        setLabel("");
    }, [label, onCreate]);

    return (
        <>
            <Tooltip title={tooltip}>
                <Button
                    onClick={handleOpen}
                    sx={{
                        minWidth: 38,
                        transition: "all 0.2s ease-in-out",
                        "&:hover": { color: "primary.main" },
                        "&:active": { transform: "scale(0.95)" },
                    }}
                    variant="outlined"
                >
                    {icon}
                </Button>
            </Tooltip>

            <Popover
                anchorEl={anchorEl}
                anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
                onClose={handleClose}
                open={Boolean(anchorEl)}
                slotProps={{
                    paper: { sx: { p: 2, mt: 1, width: 400, borderRadius: 2 } },
                }}
                transformOrigin={{ vertical: "top", horizontal: "left" }}
            >
                <Typography sx={{ fontWeight: 700, mb: 1 }} variant="subtitle1">
                    {title}
                </Typography>

                <Stack
                    alignItems="stretch"
                    direction="row"
                    spacing={1}
                    sx={{ mb: 1 }}
                >
                    <TextField
                        fullWidth
                        label={nameLabel}
                        onChange={(e) => setLabel(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") void handleCreate();
                        }}
                        size="small"
                        value={label}
                    />
                    <Button
                        disabled={!label.trim() || loading}
                        onClick={() => void handleCreate()}
                        size="small"
                        startIcon={createIcon}
                        variant="contained"
                    >
                        {createLabel}
                    </Button>
                </Stack>

                <Divider sx={{ my: 1 }} />

                {loading && entries.length === 0 ? (
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "center",
                            py: 3,
                        }}
                    >
                        <CircularProgress size={24} />
                    </Box>
                ) : entries.length === 0 ? (
                    <Typography
                        color="text.secondary"
                        sx={{ py: 2, textAlign: "center" }}
                        variant="body2"
                    >
                        {emptyText}
                    </Typography>
                ) : (
                    <List dense sx={{ maxHeight: 320, overflowY: "auto" }}>
                        {entries.map((entry) => (
                            <ListItem
                                disableGutters
                                key={entry.id}
                                secondaryAction={
                                    <Stack direction="row" spacing={0.5}>
                                        {actions.map((action) => (
                                            <Tooltip
                                                key={action.tooltip}
                                                title={action.tooltip}
                                            >
                                                <span>
                                                    <IconButton
                                                        color={action.color}
                                                        disabled={
                                                            busyId !== null
                                                        }
                                                        edge="end"
                                                        onClick={() =>
                                                            action.onClick(
                                                                entry,
                                                                handleClose,
                                                            )
                                                        }
                                                        size="small"
                                                    >
                                                        {action.icon}
                                                    </IconButton>
                                                </span>
                                            </Tooltip>
                                        ))}
                                    </Stack>
                                }
                            >
                                <ListItemText {...renderEntry(entry)} />
                            </ListItem>
                        ))}
                    </List>
                )}
            </Popover>

            {children}
        </>
    );
}
