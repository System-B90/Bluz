import { CurriculumDocument } from "@/api-client/gant/curriculum";
import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { CreateDraftAction } from "@/components/gant/curriculum-fab/action-items/CreateDraftAction";
import { DeleteCurriculumAction } from "@/components/gant/curriculum-fab/action-items/DeleteCurriculumAction";
import { DuplicateCurriculumAction } from "@/components/gant/curriculum-fab/action-items/DuplicateCurriculumAction";
import { ToggleDraftAction } from "@/components/gant/curriculum-fab/action-items/ToggleDraftAction";
import { Box, ButtonProps } from "@mui/material";
import { useState } from "react";

export interface CreateNewCurriculumProps extends Omit<ButtonProps, 'sx' | 'onClick'>
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
            display='flex'
            flexDirection="row"
            gap={ 0.5 }
            sx={ { mt: 1, mb: 0.5 } }
            flexWrap={ 'wrap' }
            alignItems={ 'center' }
            justifyContent={ 'center' }
            justifyItems={ 'center' }
        >
            <CreateDraftAction
                onCreate={ onCreate }
                onProcessingChange={ setIsProcessing }
                disabled={ isDisabled }
                { ...props }
            />
            <DuplicateCurriculumAction
                sourceCurriculum={ sourceCurriculum }
                onCreate={ onCreate }
                onProcessingChange={ setIsProcessing }
                disabled={ isDisabled || !sourceCurriculum }
            />
            <ToggleDraftAction
                sourceCurriculum={ sourceCurriculum }
                onUpdate={ onUpdate }
                onProcessingChange={ setIsProcessing }
                disabled={ isDisabled || !sourceCurriculum }
            />
            <DeleteCurriculumAction
                sourceCurriculum={ sourceCurriculum }
                onDelete={ onDelete }
                onProcessingChange={ setIsProcessing }
                disabled={ isDisabled || !sourceCurriculum }
            />
        </Box>
    );
}
