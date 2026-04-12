import { ModuleEvent, Syllabus, Curriculum, Module } from "@/api-shared/types/gant/curriculum";

export type ApiModuleEvent = ModuleEvent;
export interface ApiModule extends Omit<Module, 'events'>
{
    events: Array<ModuleEvent>;
}

export interface ApiSyllabus extends Omit<Syllabus, 'modules'>
{
    modules: Array<ApiModule>;
}

export interface ApiCurriculum extends Omit<Curriculum, 'syllabuses'>
{
    syllabuses: Array<ApiSyllabus>;
}
