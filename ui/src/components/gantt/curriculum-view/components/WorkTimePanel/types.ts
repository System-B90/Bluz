import { GanttCurriculumDocument } from '@/api-client/gantt/curriculum';
import { GanttCurriculumId } from '@/api-shared/types/gantt/curriculum';

export interface WorkTimePanelProps
{
    curriculumId: GanttCurriculumId | null;
    curriculum: GanttCurriculumDocument | undefined;
}
