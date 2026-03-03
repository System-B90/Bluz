export interface BaseCurriculumItem { id: string; }
export enum ModuleEventType
{
    Other,
    Lecture,
    Exercise,
    SelfTeaching,
}
export interface ModuleEventRequirements
{
    // TODO: Implement
}
export interface ModuleEvent extends BaseCurriculumItem 
{
    title: string;
    type: ModuleEventType;
    minimumDuration: number;
    allocatedDuration: number;
    requirements: Array<ModuleEventRequirements>;
}
export type ModuleEventId = ModuleEvent[ 'id' ];
export interface Module extends BaseCurriculumItem
{
    title: string;
    description: string;
    events: Array<ModuleEventId>;
    hiveIds: Array<number>;
}
export type ModuleId = Module[ 'id' ];
export interface Syllabus extends BaseCurriculumItem
{
    title: string;
    hiveIds: Array<number>;
    modules: Array<ModuleId>;
}
export type SyllabusId = Syllabus[ 'id' ];
export interface Curriculum extends BaseCurriculumItem
{
    title: string;
    description: string;
    syllabuses: Array<SyllabusId>;
    draft: boolean;
    totalWorkingHours: number;
}
export type CurriculumId = Curriculum[ 'id' ];

export function makeCurriculum(curriculum?: Partial<Curriculum>): Curriculum
{
    return {
        id: curriculum?.id ?? crypto.randomUUID(),
        title: curriculum?.title ?? 'הגאנט שלי',
        description: curriculum?.description ?? 'הגאנט של הקורס החדש שלי',
        syllabuses: curriculum?.syllabuses ?? [],
        draft: curriculum?.draft ?? true,
        totalWorkingHours: curriculum?.totalWorkingHours ?? 0,
    };
}

export function makeSyllabus(syllabus?: Partial<Syllabus>): Syllabus
{
    return {
        id: syllabus?.id ?? crypto.randomUUID(),
        title: syllabus?.title ?? 'סילבוס חדש',
        hiveIds: syllabus?.hiveIds ?? [],
        modules: syllabus?.modules ?? [],
    };
}

export function makeModule(module?: Partial<Module>): Module
{
    return {
        id: module?.id ?? crypto.randomUUID(),
        title: module?.title ?? 'מערך חדש',
        description: module?.description ?? 'המערך החדש שלי',
        hiveIds: module?.hiveIds ?? [],
        events: module?.events ?? [],
    };
}
