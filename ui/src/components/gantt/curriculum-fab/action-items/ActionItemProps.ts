import { ButtonProps } from '@mui/material';

import { GanttCurriculumDocument } from '@/api-client/gantt/curriculum';

export interface BaseActionItemProps extends Omit<ButtonProps, 'children'>
{
    onProcessingChange: (isProcessing: boolean) => void;
}

export interface CurriculumAwareActionItemProps extends BaseActionItemProps
{
    sourceCurriculum?: GanttCurriculumDocument | null;
}
