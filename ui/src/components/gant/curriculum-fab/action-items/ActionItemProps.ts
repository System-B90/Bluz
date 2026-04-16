import { ButtonProps } from '@mui/material';

import { CurriculumDocument } from '@/api-client/gant/curriculum';

export interface BaseActionItemProps extends Omit<ButtonProps, 'children'>
{
    onProcessingChange: (isProcessing: boolean) => void;
}

export interface CurriculumAwareActionItemProps extends BaseActionItemProps
{
    sourceCurriculum?: CurriculumDocument | null;
}
