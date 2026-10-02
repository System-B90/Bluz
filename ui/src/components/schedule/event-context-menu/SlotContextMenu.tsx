"use client";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { useCallback, useState } from "react";

import { PasteSlot } from "@/components/schedule/calendar/calendar/paste";
import { OpenSlotContextMenu } from "@/components/schedule/calendar/calendar/slot-context-menu";

export type SlotContextMenuTarget = {
    position: { top: number; left: number };
    slot: PasteSlot;
};

/** Open/close state for {@link SlotContextMenu}, opened at the pointer. */
export function useSlotContextMenu() {
    const [target, setTarget] = useState<null | SlotContextMenuTarget>(null);
    const open = useCallback<OpenSlotContextMenu>(
        (slot, clientX, clientY) => setTarget({ slot, position: { top: clientY, left: clientX } }),
        [],
    );
    const close = useCallback(() => setTarget(null), []);
    return { target, open, close };
}

/**
 * Right-click menu for empty grid (#859): pastes the clipboard event at the
 * slot under the pointer, like a desktop paste at the cursor.
 */
export function SlotContextMenu({
    target,
    canPaste,
    onPaste,
    onClose,
}: {
    target: null | SlotContextMenuTarget;
    /** False on a past iteration, whose writes the server rejects. */
    canPaste: boolean;
    onPaste: (slot: PasteSlot) => void;
    onClose: () => void;
}) {
    if (!target) return null;
    return (
        <Menu
            anchorPosition={target.position}
            anchorReference="anchorPosition"
            onClose={onClose}
            open
            slotProps={{ paper: { sx: { minWidth: 200 } } }}
        >
            <MenuItem
                disabled={!canPaste}
                onClick={() => {
                    onPaste(target.slot);
                    onClose();
                }}
            >
                <ListItemIcon>
                    <ContentPasteIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>הדבקה</ListItemText>
                <Typography color="text.secondary" sx={{ marginInlineStart: 2 }} variant="body2">
                    Ctrl+V
                </Typography>
            </MenuItem>
        </Menu>
    );
}
