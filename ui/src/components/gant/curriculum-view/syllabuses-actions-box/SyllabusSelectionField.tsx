import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { CurriculumId, SyllabusId } from "@/api-shared/types/gant/curriculum";
import { useCurriculum } from "@/components/gant/state/hooks";
import { useSyllabusActions } from "@/components/gant/state/hooks/gant-funcs/UseSyllabusActions";
import { useCurriculumState } from "@/components/gant/state/provider";
import { useSyllabusNames } from "@/components/gant/state/providers/SyllabusNamesProvider";
import AddIcon from '@mui/icons-material/Add';
import { Box, BoxProps, FormControl, IconButton, InputLabel, MenuItem, Select, SelectChangeEvent, Tooltip } from "@mui/material";
import { useSnackbar } from "notistack";
import { useCallback, useMemo, useState } from "react";

export interface SyllabusSelectionFieldProps extends BoxProps
{
    curriculumId: CurriculumId;
}

export default function SyllabusSelectionField({ curriculumId, ...props }: SyllabusSelectionFieldProps)
{
    const { enqueueSnackbar } = useSnackbar();
    const curriculum = useCurriculum(curriculumId);
    const { linkSyllabusToCurriculum } = useSyllabusActions();
    const { syllabusNames } = useSyllabusNames();
    const [ currentSyllabusId, setCurrentSyllabusId ] = useState<SyllabusId>("");

    const onChange = useCallback((ev: SelectChangeEvent<SyllabusId>) =>
    {
        const syllabusId = ev.target.value as SyllabusId;
        setCurrentSyllabusId(syllabusId);
    }, []);

    const addClickHandler = useCallback(() =>
    {
        const syllabusId = currentSyllabusId;
        if (!syllabusId) { return; }
        linkSyllabusToCurriculum(curriculumId, syllabusId).catch((error) => enqueueApiErrorSnackbar(enqueueSnackbar, 'הוספת הסילבוס לגאנט נכשלה!', error));
    }, [ curriculumId, currentSyllabusId, linkSyllabusToCurriculum, enqueueSnackbar ]);

    const syllabusMenuItems = useMemo(() => Object.entries(syllabusNames)
        .filter(([ syllabusId, ]) => !curriculum?.syllabuses || !curriculum?.syllabuses.includes(syllabusId))
        .map(([ syllabusId, syllabusName ]) => (
            <MenuItem key={ syllabusId } value={ syllabusId }>
                { syllabusName }
            </MenuItem>
        )), [ curriculum?.syllabuses, syllabusNames ]);

    return (
        <Box { ...props }>
            <FormControl fullWidth={ true }>
                <InputLabel>סילבוס קיים</InputLabel>
                <Select
                    value={ currentSyllabusId }
                    label="סילבוס קיים"
                    onChange={ onChange }
                >
                    { syllabusMenuItems }
                </Select>
            </FormControl >
            <Tooltip title='הוספת סילבוס לגאנט'>
                <IconButton onClick={ addClickHandler } disabled={ currentSyllabusId.length === 0 }>
                    <AddIcon color={ currentSyllabusId.length > 0 ? 'info' : 'disabled' } />
                </IconButton>
            </Tooltip>
        </Box>
    );
}
