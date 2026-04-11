export interface BaseGantItem { id: string; title: string; }
export enum ModuleEventType
{
    Lecture = 'הרצאה',
    Exercise = 'ע"ע',
    SelfTeaching = 'ל"ע',
    Other = 'אחר',
}

export interface ModuleEventRequirements
{
    // TODO: Implement
}
export interface ModuleEvent extends BaseGantItem 
{
    title: string;
    type: ModuleEventType;
    minimumDuration: number;
    allocatedDuration: number;
    requirements: Array<ModuleEventRequirements>;
}
export type ModuleEventId = ModuleEvent[ 'id' ];
export interface Module extends BaseGantItem
{
    title: string;
    description: string;
    events: Array<ModuleEventId>;
    hiveIds: Array<number>;
}
export type ModuleId = Module[ 'id' ];
export interface Syllabus extends BaseGantItem
{
    title: string;
    hiveIds: Array<number>;
    modules: Array<ModuleId>;
}
export type SyllabusId = Syllabus[ 'id' ];
export enum DayName
{
    Sunday = 'ראשון',
    Monday = 'שני',
    Tuesday = 'שלישי',
    Wednesday = 'רביעי',
    Thursday = 'חמישי',
    Friday = 'שישי',
    Saturday = 'שבת',
}
export interface CurriculumDays
{
    day: DayName;
    totalWorkingHours: number;
}
export interface CurriculumWeek
{
    number: number;
    days: Array<CurriculumDays>;
}
export interface Curriculum extends BaseGantItem
{
    title: string;
    description: string;
    syllabuses: Array<SyllabusId>;
    draft: boolean;
    weeks: Array<CurriculumWeek>;
}
export type CurriculumId = Curriculum[ 'id' ];

type MakerReturnType<T extends BaseGantItem> = Omit<T, 'id'> & { id: T[ 'id' ] | undefined; };
export function makeCurriculum(curriculum?: Partial<Curriculum>): MakerReturnType<Curriculum>
{
    return {
        id: curriculum?.id,
        title: curriculum?.title ?? 'הגאנט שלי',
        description: curriculum?.description ?? 'הגאנט של הקורס החדש שלי',
        syllabuses: curriculum?.syllabuses ?? [],
        draft: curriculum?.draft ?? true,
        weeks: curriculum?.weeks ?? [],
    };
}

export function makeSyllabus(syllabus?: Partial<Syllabus>): MakerReturnType<Syllabus>
{
    return {
        id: syllabus?.id,
        title: syllabus?.title ?? 'סילבוס חדש',
        hiveIds: syllabus?.hiveIds ?? [],
        modules: syllabus?.modules ?? [],
    };
}

export function makeModule(module?: Partial<Module>): MakerReturnType<Module>
{
    return {
        id: module?.id,
        title: module?.title ?? 'מערך חדש',
        description: module?.description ?? 'המערך החדש שלי',
        hiveIds: module?.hiveIds ?? [],
        events: module?.events ?? [],
    };
}

export function makeModuleEvent(moduleEvent?: Partial<ModuleEvent>): MakerReturnType<ModuleEvent>
{
    return {
        id: moduleEvent?.id,
        title: moduleEvent?.title ?? 'מופע חדש',
        allocatedDuration: moduleEvent?.allocatedDuration ?? 0,
        minimumDuration: moduleEvent?.minimumDuration ?? 45,
        type: moduleEvent?.type ?? ModuleEventType.Other,
        requirements: moduleEvent?.requirements ?? [],
    };
}
