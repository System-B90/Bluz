import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import ListSubheader from "@mui/material/ListSubheader";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useSnackbar } from "notistack";
import { useState } from "react";

import { GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function MoveEventDialog({
    open,
    onClose,
    eventId,
    currentModuleId,
}: {
    open: boolean;
    onClose: () => void;
    eventId: GanttEventId;
    currentModuleId: GanttModuleId;
}) {
    const { enqueueSnackbar } = useSnackbar();
    const { moveEvent } = useModuleEventActions();
    const state = useCurriculumState();
    const [destModuleId, setDestModuleId] = useState<"" | GanttModuleId>("");

    const syllabuses = Object.values(state.syllabuses);

    async function handleConfirm() {
        if (!destModuleId) return;
        moveEvent(eventId, currentModuleId, destModuleId)
            .then(() => {
                enqueueSnackbar("המופע הועבר בהצלחה", { variant: "success" });
                onClose();
            })
            .catch((error) =>
                enqueueApiErrorSnackbar(enqueueSnackbar, "העברת המופע נכשלה!", error),
            );
    }

    function handleClose() {
        setDestModuleId("");
        onClose();
    }

    return (
        <Dialog fullWidth maxWidth="xs" onClose={handleClose} open={open}>
            <DialogTitle>העבר מופע למערך אחר</DialogTitle>
            <DialogContent>
                <FormControl fullWidth size="small" sx={{ mt: 1 }}>
                    <InputLabel>בחירת מערך</InputLabel>
                    <Select
                        label="בחירת מערך"
                        onChange={(e) => setDestModuleId(e.target.value as GanttModuleId)}
                        value={destModuleId}
                    >
                        {syllabuses.map((syllabus) => {
                            const modules = syllabus.modules
                                .map((mId) => state.modules[mId])
                                .filter((m) => m && m.id !== currentModuleId);

                            if (!modules.length) return null;

                            return [
                                <ListSubheader key={`s-${syllabus.id}`}>
                                    {syllabus.title}
                                </ListSubheader>,
                                ...modules.map((m) => (
                                    <MenuItem key={m.id} value={m.id}>
                                        {m.title}
                                    </MenuItem>
                                )),
                            ];
                        })}
                    </Select>
                </FormControl>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose}>ביטול</Button>
                <Button
                    disabled={!destModuleId}
                    onClick={handleConfirm}
                    variant="contained"
                >
                    העבר
                </Button>
            </DialogActions>
        </Dialog>
    );
}
