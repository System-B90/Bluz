import LinkIcon from "@mui/icons-material/Link";
import Box, { BoxProps } from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputAdornment from "@mui/material/InputAdornment";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import { SelectChangeEvent } from "@mui/material/Select";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
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
    const { syllabusNames, syllabusCurriculums } = useSyllabusNames();
    const [isLinking, setIsLinking] = useState<boolean>(false);

    // Selecting a syllabus links it immediately — no separate add button —
    // mirroring how a curriculum is linked to an iteration
    // (`IterationLinkField`). The select stays empty since a linked syllabus
    // drops out of `syllabusMenuItems` on the next render.
    const onChange = useCallback(
        (ev: SelectChangeEvent<GanttSyllabusId>) => {
            const syllabusId = ev.target.value as GanttSyllabusId;
            if (!syllabusId) {
                return;
            }
            setIsLinking(true);
            linkSyllabusToCurriculum(curriculumId, syllabusId)
                .catch((error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "הוספת הסילבוס לגאנט נכשלה!",
                        error,
                    ),
                )
                .finally(() => setIsLinking(false));
        },
        [curriculumId, linkSyllabusToCurriculum, enqueueSnackbar],
    );

    const syllabusMenuItems = useMemo(
        () =>
            Object.entries(syllabusNames)
                .filter(
                    ([syllabusId]) =>
                        !curriculum?.syllabuses ||
                        !curriculum?.syllabuses.includes(syllabusId),
                )
                .map(([syllabusId, syllabusName]) => {
                    // A syllabus can belong to several curriculums. Linking one
                    // that is already in use elsewhere is legitimate but worth
                    // flagging, since edits to it are shared. The parent ids
                    // come from the list response itself — no extra fetch. #310
                    const otherCurriculums = (
                        syllabusCurriculums[syllabusId] ?? []
                    ).filter((id) => id !== curriculumId);

                    return (
                        <MenuItem key={syllabusId} value={syllabusId}>
                            {syllabusName}
                            {otherCurriculums.length > 0 ? (
                                <Typography
                                    color="text.secondary"
                                    component="span"
                                    sx={{ marginInlineStart: 1 }}
                                    variant="caption"
                                >
                                    {otherCurriculums.length === 1
                                        ? "(משותף עם גאנט נוסף)"
                                        : `(משותף עם ${otherCurriculums.length} גאנטים)`}
                                </Typography>
                            ) : null}
                        </MenuItem>
                    );
                }),
        [curriculum?.syllabuses, curriculumId, syllabusCurriculums, syllabusNames],
    );

    return (
        <Box {...props}>
            <FormControl fullWidth={true} size="small">
                <InputLabel>הוספת סילבוס לגאנט</InputLabel>
                <Select
                    disabled={isLinking}
                    endAdornment={
                        <InputAdornment
                            sx={{ marginInlineEnd: 2 }}
                            position="end"
                        >
                            {isLinking ? (
                                <CircularProgress
                                    color="inherit"
                                    size={16}
                                />
                            ) : (
                                <LinkIcon
                                    color="disabled"
                                    fontSize="small"
                                />
                            )}
                        </InputAdornment>
                    }
                    fullWidth
                    label="הוספת סילבוס לגאנט"
                    onChange={onChange}
                    value=""
                >
                    {syllabusMenuItems}
                </Select>
            </FormControl>
        </Box>
    );
}
