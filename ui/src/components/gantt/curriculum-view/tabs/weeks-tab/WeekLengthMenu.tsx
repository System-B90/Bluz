import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import { useSnackbar } from "notistack";
import { MouseEvent, useCallback, useMemo, useState } from "react";

import {
    GanttCurriculum,
    GanttCurriculumId,
} from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useCurriculumState } from "@/components/gantt/state/context";
import { useWeekActions } from "@/components/gantt/state/hooks/gantt-funcs/UseWeekActions";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";

export type WeekLengthMenuProps = {
    curriculum: GanttCurriculum;
    curriculumId: GanttCurriculumId;
};

export function WeekLengthMenu({
    curriculum,
    curriculumId,
}: WeekLengthMenuProps) {
    const { enqueueSnackbar } = useSnackbar();
    const state = useCurriculumState();
    const {
        state: { mappings },
        refreshMappings,
    } = useGanttMappings();
    const { createWeek, deleteWeek } = useWeekActions();
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false);

    const lastWeek = useMemo(() => {
        const lastWeekId = curriculum.weeks.at(-1);
        return lastWeekId ? state.weeks[lastWeekId] : undefined;
    }, [curriculum.weeks, state.weeks]);

    const mappedItemsInLastWeek = useMemo(() => {
        if (!lastWeek) return 0;

        return Object.values(mappings).filter((mapping) =>
            lastWeek.days.includes(mapping.dayId),
        ).length;
    }, [lastWeek, mappings]);

    const closeMenu = useCallback(() => setAnchorEl(null), []);

    const openMenu = useCallback((event: MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    }, []);

    const addWeek = useCallback(() => {
        closeMenu();
        const nextNumber = curriculum.weeks.length + 1;

        void createWeek({
            curriculumId,
            number: nextNumber,
            comment: "",
            weekendDuty: false,
        }).catch((error) =>
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "הוספת שבוע נכשלה!",
                error,
            ),
        );
    }, [
        closeMenu,
        createWeek,
        curriculum.weeks,
        curriculumId,
        enqueueSnackbar,
    ]);

    const removeLastWeek = useCallback(() => {
        closeMenu();
        if (!lastWeek) return;

        if (mappedItemsInLastWeek > 0) {
            setConfirmRemoveOpen(true);
            return;
        }

        void deleteWeek(lastWeek.id, curriculumId)
            .then(() => refreshMappings())
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "מחיקת שבוע נכשלה!",
                    error,
                ),
            );
    }, [
        closeMenu,
        curriculumId,
        deleteWeek,
        enqueueSnackbar,
        lastWeek,
        mappedItemsInLastWeek,
        refreshMappings,
    ]);

    const confirmRemoveLastWeek = useCallback(() => {
        if (!lastWeek) return;

        setConfirmRemoveOpen(false);
        void deleteWeek(lastWeek.id, curriculumId)
            .then(() => refreshMappings())
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "מחיקת שבוע נכשלה!",
                    error,
                ),
            );
    }, [curriculumId, deleteWeek, enqueueSnackbar, lastWeek, refreshMappings]);

    return (
        <>
            <Button
                endIcon={<ExpandMoreIcon />}
                onClick={openMenu}
                size="small"
                variant="outlined"
            >
                ניהול אורך קורס
            </Button>
            <Menu
                anchorEl={anchorEl}
                onClose={closeMenu}
                open={Boolean(anchorEl)}
            >
                <MenuItem onClick={addWeek}>
                    <ListItemIcon>
                        <AddIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="הוספת שבוע לסוף הקורס" />
                </MenuItem>
                <MenuItem disabled={!lastWeek} onClick={removeLastWeek}>
                    <ListItemIcon>
                        <DeleteOutlineIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText primary="מחיקת השבוע האחרון" />
                </MenuItem>
            </Menu>
            <Dialog
                onClose={() => setConfirmRemoveOpen(false)}
                open={confirmRemoveOpen}
            >
                <DialogTitle>מחיקת השבוע האחרון?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        בשבוע האחרון קיימים {mappedItemsInLastWeek} שיבוצים.
                        מחיקת השבוע תמחק גם את השיבוצים האלו.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setConfirmRemoveOpen(false)}>
                        ביטול
                    </Button>
                    <Button
                        color="error"
                        onClick={confirmRemoveLastWeek}
                        variant="contained"
                    >
                        מחיקה
                    </Button>
                </DialogActions>
            </Dialog>
        </>
    );
}
