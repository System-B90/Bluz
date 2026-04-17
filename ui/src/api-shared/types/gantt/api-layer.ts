import { RawBaseDocument } from "@/api-client/gantt/base";
import { Curriculum, CurriculumDay, CurriculumDayId, CurriculumId, CurriculumWeek, CurriculumWeekId, Module, ModuleEvent, ModuleEventId, ModuleId, Syllabus, SyllabusId } from "@/api-shared/types/gantt/curriculum";

export interface ApiModuleEvent extends Omit<ModuleEvent & RawBaseDocument, 'allocatedDuration'>
{
    cEC: Array<{ eventId: ModuleEventId; curriculumId: CurriculumId; allocatedDuration: number; }>;
}

export interface ApiModule extends Omit<Module & RawBaseDocument, 'events'>
{
    m2e: Array<{ moduleId: ModuleId; eventId: ModuleEventId; event: ApiModuleEvent; }>;
}

export interface ApiSyllabus extends Omit<Syllabus & RawBaseDocument, 'modules'>
{
    s2m: Array<{ syllabusId: SyllabusId; moduleId: ModuleId; module: ApiModule; }>;
}

export interface ApiCurriculumDay extends Omit<CurriculumDay & RawBaseDocument, 'title'>
{
}

export interface ApiCurriculumWeek extends Omit<CurriculumWeek & RawBaseDocument, 'days'>
{
    w2d: Array<{ weekId: CurriculumWeekId; dayId: CurriculumDayId; day: ApiCurriculumDay; }>;
}

export interface ApiCurriculum extends Omit<Curriculum & RawBaseDocument, 'syllabuses' | 'weeks'>
{
    c2s: Array<{ curriculumId: CurriculumId; syllabusId: SyllabusId; syllabus: ApiSyllabus; }>;
    c2w: Array<{ curriculumId: CurriculumId; weekId: CurriculumWeekId; week: ApiCurriculumWeek; }>;
}
