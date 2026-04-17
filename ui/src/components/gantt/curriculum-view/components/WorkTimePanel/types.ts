import { CurriculumDocument } from '@/api-client/gantt/curriculum';
import { CurriculumId } from '@/api-shared/types/gantt/curriculum';

export interface WorkTimePanelProps
{
    curriculumId: CurriculumId | null;
    curriculum: CurriculumDocument | undefined;
}
