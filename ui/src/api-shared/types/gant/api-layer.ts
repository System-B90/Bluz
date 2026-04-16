import { Curriculum, CurriculumDay, CurriculumWeek, Module, ModuleEvent, Syllabus } from "@/api-shared/types/gant/curriculum";

export type ApiModuleEvent = ModuleEvent;
export interface ApiModule extends Omit<Module, 'events'>
{
    events: Array<ModuleEvent>;
}

export interface ApiSyllabus extends Omit<Syllabus, 'modules'>
{
    modules: Array<ApiModule>;
}

export interface ApiCurriculumDay extends Omit<CurriculumDay, 'id'>
{
}

export interface ApiCurriculumWeek extends Omit<CurriculumWeek, 'days'>
{
    days: Array<ApiCurriculumDay>;
}

export interface ApiCurriculum extends Omit<Curriculum, 'syllabuses' | 'weeks'>
{
    syllabuses: Array<ApiSyllabus>;
    weeks: Array<ApiCurriculumWeek>;
}
