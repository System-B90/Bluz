import { ModuleEvent, Syllabus, Curriculum } from "@/api-shared/types/gant/curriculum";
import Module from "module";

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
