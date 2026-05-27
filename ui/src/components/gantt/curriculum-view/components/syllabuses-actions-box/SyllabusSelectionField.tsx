import LinkIcon from "@mui/icons-material/Link";
import {
    Box,
    BoxProps,
    CircularProgress,
    FormControl,
    IconButton,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
    Tooltip,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { useCallback, useMemo, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import {
    GanttCurriculumId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";
import { useCurriculum } from "@/components/gantt/state/hooks/UseCurriculum";
import { useSyllabusNames } from "@/components/gantt/state/providers/SyllabusNamesProvider";

export type SyllabusSelectionFieldProps = {
  curriculumId: GanttCurriculumId;
} & BoxProps;

export function SyllabusSelectionField({
    curriculumId,
    ...props
}: SyllabusSelectionFieldProps) {
    const { enqueueSnackbar } = useSnackbar();
    const curriculum = useCurriculum(curriculumId);
    const { linkSyllabusToCurriculum } = useSyllabusActions();
    const { syllabusNames } = useSyllabusNames();
    const [currentSyllabusId, setCurrentSyllabusId] =
    useState<GanttSyllabusId>("");
    const [isLinking, setIsLinking] = useState<boolean>(false);

    const onChange = useCallback((ev: SelectChangeEvent<GanttSyllabusId>) => {
        const syllabusId = ev.target.value as GanttSyllabusId;
        setCurrentSyllabusId(syllabusId);
    }, []);

    const addClickHandler = useCallback(() => {
        setIsLinking(true);
        const syllabusId = currentSyllabusId;
        if (!syllabusId) {
            return;
        }
        linkSyllabusToCurriculum(curriculumId, syllabusId)
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "הוספת הסילבוס לגאנט נכשלה!",
                    error,
                ),
            )
            .finally(() => setIsLinking(false));

        setCurrentSyllabusId("");
    }, [
        curriculumId,
        currentSyllabusId,
        linkSyllabusToCurriculum,
        enqueueSnackbar,
    ]);

    const syllabusMenuItems = useMemo(
        () =>
            Object.entries(syllabusNames)
                .filter(
                    ([syllabusId]) =>
                        !curriculum?.syllabuses ||
            !curriculum?.syllabuses.includes(syllabusId),
                )
                .map(([syllabusId, syllabusName]) => (
                    <MenuItem key={syllabusId} value={syllabusId}>
                        {syllabusName}
                    </MenuItem>
                )),
        [curriculum?.syllabuses, syllabusNames],
    );

    return (
        <Box {...props}>
            <FormControl fullWidth={true}>
                <InputLabel>סילבוסים קיימים</InputLabel>
                <Select
                    fullWidth
                    label="סילבוסים קיימים"
                    onChange={onChange}
                    value={currentSyllabusId}
                >
                    {syllabusMenuItems}
                </Select>
            </FormControl>
            <Tooltip title="הוספת סילבוס לגאנט">
                <IconButton
                    disabled={currentSyllabusId.length === 0}
                    onClick={addClickHandler}
                >
                    {isLinking ? (
                        <CircularProgress color="inherit" size={24} />
                    ) : (
                        <LinkIcon
                            color={currentSyllabusId.length > 0 ? "info" : "disabled"}
                            fontSize="medium"
                        />
                    )}
                </IconButton>
            </Tooltip>
        </Box>
    );
}
