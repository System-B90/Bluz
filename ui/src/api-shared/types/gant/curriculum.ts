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
    Sunday = 0,
    Monday = 1,
    Tuesday = 2,
    Wednesday = 3,
    Thursday = 4,
    Friday = 5,
    Saturday = 6,
}

export const DAY_NAME_DISPLAY: Record<DayName, string> = {
    [DayName.Sunday]: 'ראשון',
    [DayName.Monday]: 'שני',
    [DayName.Tuesday]: 'שלישי',
    [DayName.Wednesday]: 'רביעי',
    [DayName.Thursday]: 'חמישי',
    [DayName.Friday]: 'שישי',
    [DayName.Saturday]: 'שבת',
};

export function getDayNameDisplay(day: DayName): string {
    return DAY_NAME_DISPLAY[day] ?? '';
}
export interface CurriculumDay
{
    day: DayName;
    totalWorkingHours: number;
    comment?: string;
}
export type CurriculumDayId = string;

export interface CurriculumWeek
{
    number: number;
    days: Array<CurriculumDayId>;
    comment?: string;
    closingSaturday: boolean;
}
export type CurriculumWeekId = string;

export interface Curriculum extends BaseGantItem
{
    title: string;
    description: string;
    syllabuses: Array<SyllabusId>;
    draft: boolean;
    weeks: Array<CurriculumWeekId>;
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

export function makeCurriculumWeek(week?: Partial<CurriculumWeek>): Omit<CurriculumWeek, 'id'> & { id: string | undefined; }
{
    return {
        id: undefined,
        number: week?.number ?? 1,
        days: week?.days ?? [],
        comment: week?.comment ?? '',
        closingSaturday: week?.closingSaturday ?? false,
    };
}

export function makeCurriculumDay(day?: Partial<CurriculumDay>): CurriculumDay
{
    return {
        day: day?.day ?? DayName.Sunday,
        totalWorkingHours: day?.totalWorkingHours ?? 0,
        comment: day?.comment ?? '',
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
