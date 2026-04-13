import { CurriculumDocument } from '@/api-client/gant/curriculum';
import { ButtonProps } from '@mui/material';

export interface BaseActionItemProps extends Omit<ButtonProps, 'children'>
{
    onProcessingChange: (isProcessing: boolean) => void;
}

export interface CurriculumAwareActionItemProps extends BaseActionItemProps
{
    sourceCurriculum?: CurriculumDocument | null;
}
