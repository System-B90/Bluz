import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import { useState } from "react";

import {
    GRID_MENU_LABELS,
    GridMenuAction,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/grid-context-menu";

export type GridMenuTarget = {
    position: { top: number; left: number };
    actions: Array<GridMenuAction | null>;
    /** Number of cells "set-range" writes, shown in its dialog. */
    rangeSize: number;
};

/**
 * The gantt table's right-click menu (#858). Every entry maps onto a handler
 * the keyboard already uses; this component only renders the list, plus the
 * value prompt for "set one value for the selected cells".
 */
export function GridContextMenu({
    target,
    onAction,
    onSetRange,
    onClose,
}: {
    target: GridMenuTarget | null;
    onAction: (action: Exclude<GridMenuAction, "set-range">) => void;
    onSetRange: (text: string) => void;
    onClose: () => void;
}) {
    const [ rangePrompt, setRangePrompt ] = useState<null | number>(null);
    const [ text, setText ] = useState("");

    const submitRange = () =>
    {
        setRangePrompt(null);
        onSetRange(text);
    };

    return (
        <>
            <Menu
                anchorPosition={ target?.position }
                anchorReference="anchorPosition"
                onClose={ onClose }
                open={ target !== null }
                slotProps={ { paper: { sx: { minWidth: 220 } } } }
            >
                { target?.actions.map((action, i) => action === null
                    ? <Divider key={ `d${i}` } />
                    : (
                        <MenuItem
                            key={ action }
                            onClick={ () =>
                            {
                                onClose();
                                if (action === "set-range")
                                {
                                    setText("");
                                    setRangePrompt(target.rangeSize);
                                }
                                else onAction(action);
                            } }
                        >
                            { GRID_MENU_LABELS[ action ] }
                        </MenuItem>
                    )) }
            </Menu>
            <Dialog onClose={ () => setRangePrompt(null) } open={ rangePrompt !== null }>
                <DialogTitle>{ `הגדרת ערך ל-${rangePrompt ?? 0} תאים` }</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label="שעות"
                        margin="dense"
                        onChange={ (e) => setText(e.target.value) }
                        onKeyDown={ (e) =>
                        {
                            if (e.key === "Enter") submitRange();
                        } }
                        placeholder="1.5 או 1:30"
                        value={ text }
                    />
                </DialogContent>
                <DialogActions>
                    <Button color="inherit" onClick={ () => setRangePrompt(null) }>ביטול</Button>
                    <Button onClick={ submitRange } variant="contained">החלה</Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
