import { Box, ButtonProps } from "@mui/material";
import { useState } from "react";

import { CurriculumDocument } from "@/api-client/gant/curriculum";
import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { CreateDraftAction } from "@/components/gant/curriculum-fab/action-items/CreateDraftAction";
import { DeleteCurriculumAction } from "@/components/gant/curriculum-fab/action-items/DeleteCurriculumAction";
import { DuplicateCurriculumAction } from "@/components/gant/curriculum-fab/action-items/DuplicateCurriculumAction";
import { ToggleDraftAction } from "@/components/gant/curriculum-fab/action-items/ToggleDraftAction";

export interface CreateNewCurriculumProps extends Omit<ButtonProps, 'onClick' | 'sx'>
{
    disabled: boolean;
    onCreate: (newCurriculum: CurriculumDocument) => void;
    onUpdate: (updatedCurriculum: CurriculumDocument) => void;
    onDelete: (deletedCurriculumId: CurriculumId) => void;
    sourceCurriculum?: CurriculumDocument | null;
}

export function CurriculumActionItems({ onCreate, onUpdate, onDelete, disabled, sourceCurriculum, ...props }: CreateNewCurriculumProps)
{
    const [ isProcessing, setIsProcessing ] = useState(false);
    const isDisabled = disabled || isProcessing;

    return (
        <Box
            alignItems={ 'center' }
            display='flex'
            flexDirection="row"
            flexWrap={ 'wrap' }
            gap={ 0.5 }
            justifyContent={ 'center' }
            justifyItems={ 'center' }
            sx={ { mt: 1, mb: 0.5 } }
        >
            <CreateDraftAction
                disabled={ isDisabled }
                onCreate={ onCreate }
                onProcessingChange={ setIsProcessing }
                { ...props }
            />
            <DuplicateCurriculumAction
                disabled={ isDisabled || !sourceCurriculum }
                onCreate={ onCreate }
                onProcessingChange={ setIsProcessing }
                sourceCurriculum={ sourceCurriculum }
            />
            <ToggleDraftAction
                disabled={ isDisabled || !sourceCurriculum }
                onProcessingChange={ setIsProcessing }
                onUpdate={ onUpdate }
                sourceCurriculum={ sourceCurriculum }
            />
            <DeleteCurriculumAction
                disabled={ isDisabled || !sourceCurriculum }
                onDelete={ onDelete }
                onProcessingChange={ setIsProcessing }
                sourceCurriculum={ sourceCurriculum }
            />
        </Box>
    );
}
