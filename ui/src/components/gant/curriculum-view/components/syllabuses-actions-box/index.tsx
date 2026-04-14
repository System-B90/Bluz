import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { CreateSyllabusButton } from "@/components/gant/curriculum-view/components/syllabuses-actions-box/CreateSyllabusButton";
import SyllabusSelectionField from "@/components/gant/curriculum-view/components/syllabuses-actions-box/SyllabusSelectionField";
import { Box, BoxProps } from "@mui/material";

export interface SyllabusesActionsBoxProps extends Omit<BoxProps, 'display' | 'justifyContent'>
{
    curriculumId: CurriculumId;
};

export function SyllabusesActionsBox({ curriculumId, ...props }: SyllabusesActionsBoxProps)
{
    return (
        <Box display="flex" justifyContent="flex-start" gap={ 2 } { ...props }>
            <CreateSyllabusButton curriculumId={ curriculumId } />
            <SyllabusSelectionField
                curriculumId={ curriculumId }
                display='flex'
                flexDirection='row'
                alignItems={ 'center' }
                gap={ 1 }
                className="w-100"
            />
        </Box>
    );
}
