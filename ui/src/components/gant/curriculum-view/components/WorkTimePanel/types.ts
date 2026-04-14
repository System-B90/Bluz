import { CurriculumDocument } from '@/api-client/gant/curriculum';
import { CurriculumId } from '@/api-shared/types/gant/curriculum';

export interface WorkTimePanelProps
{
    curriculumId: CurriculumId | null;
    curriculum: CurriculumDocument | undefined;
}
