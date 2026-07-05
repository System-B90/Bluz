import GroupsIcon from "@mui/icons-material/Groups";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import { useSnackbar } from "notistack";
import { useCallback } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";

/**
 * Free-text chips editor for the syllabus' shuffle (student group) names.
 * Modules and events can then be tagged with a subset of these names.
 */
export function SyllabusShuffles({
    syllabusId,
}: {
    syllabusId: GanttSyllabusId;
}) {
    const { enqueueSnackbar } = useSnackbar();
    const syllabus = useSyllabus(syllabusId);
    const { updateSyllabus } = useSyllabusActions();

    const handleChange = useCallback(
        (_: unknown, value: Array<string>) => {
            const shuffles = Array.from(
                new Set(value.map((v) => v.trim()).filter(Boolean)),
            );
            updateSyllabus(syllabusId, { shuffles }).catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון השאפלים נכשל!",
                    error,
                ),
            );
        },
        [syllabusId, updateSyllabus, enqueueSnackbar],
    );

    if (!syllabus) return null;

    return (
        <Box
            alignItems="center"
            display="flex"
            flexDirection="row"
            gap={1}
            px={2}
            py={0.5}
        >
            <Tooltip title="שאפלים (קבוצות לימוד) בסילבוס">
                <GroupsIcon color="action" fontSize="small" />
            </Tooltip>
            <Autocomplete
                freeSolo
                fullWidth
                multiple
                onChange={handleChange}
                options={[]}
                renderInput={(params) => (
                    <TextField
                        {...params}
                        placeholder={
                            (syllabus.shuffles ?? []).length === 0
                                ? "הוספת שאפל (Enter להוספה)"
                                : undefined
                        }
                        size="small"
                        variant="standard"
                    />
                )}
                size="small"
                value={syllabus.shuffles ?? []}
            />
        </Box>
    );
}
