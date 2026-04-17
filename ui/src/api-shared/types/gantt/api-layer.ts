import { RawBaseDocument } from "@/api-client/gantt/base";
import { GanttCurriculum, GanttCurriculumId, GanttDay, GanttDayId, GanttEvent, GanttEventId, GanttModule, GanttModuleId, GanttSyllabus, GanttSyllabusId, GanttWeek, GanttWeekId } from "@/api-shared/types/gantt/curriculum";

export interface ApiModuleEvent extends Omit<GanttEvent & RawBaseDocument, 'allocatedDuration'>
{
    cEC: Array<{ eventId: GanttEventId; curriculumId: GanttCurriculumId; allocatedDuration: number; }>;
}

export interface ApiModule extends Omit<GanttModule & RawBaseDocument, 'events'>
{
    m2e: Array<{ moduleId: GanttModuleId; eventId: GanttEventId; event: ApiModuleEvent; }>;
}

export interface ApiSyllabus extends Omit<GanttSyllabus & RawBaseDocument, 'modules'>
{
    s2m: Array<{ syllabusId: GanttSyllabusId; moduleId: GanttModuleId; module: ApiModule; }>;
}

export interface ApiCurriculumDay extends Omit<GanttDay & RawBaseDocument, 'title'>
{
}

export interface ApiCurriculumWeek extends Omit<GanttWeek & RawBaseDocument, 'days'>
{
    w2d: Array<{ weekId: GanttWeekId; dayId: GanttDayId; day: ApiCurriculumDay; }>;
}

export interface ApiCurriculum extends Omit<GanttCurriculum & RawBaseDocument, 'syllabuses' | 'weeks'>
{
    c2s: Array<{ curriculumId: GanttCurriculumId; syllabusId: GanttSyllabusId; syllabus: ApiSyllabus; }>;
    c2w: Array<{ curriculumId: GanttCurriculumId; weekId: GanttWeekId; week: ApiCurriculumWeek; }>;
}
