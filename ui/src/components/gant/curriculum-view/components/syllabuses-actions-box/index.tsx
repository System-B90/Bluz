import { Box, BoxProps } from "@mui/material";

import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { CreateSyllabusButton } from "@/components/gant/curriculum-view/components/syllabuses-actions-box/CreateSyllabusButton";
import SyllabusSelectionField from "@/components/gant/curriculum-view/components/syllabuses-actions-box/SyllabusSelectionField";

export interface SyllabusesActionsBoxProps extends Omit<BoxProps, 'display' | 'justifyContent'>
{
    curriculumId: CurriculumId;
};

export function SyllabusesActionsBox({ curriculumId, ...props }: SyllabusesActionsBoxProps)
{
    return (
        <Box display="flex" gap={ 2 } justifyContent="flex-start" { ...props }>
            <CreateSyllabusButton curriculumId={ curriculumId } />
            <SyllabusSelectionField
                alignItems={ 'center' }
                className="w-100"
                curriculumId={ curriculumId }
                display='flex'
                flexDirection='row'
                gap={ 1 }
            />
        </Box>
    );
}
