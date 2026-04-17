import { ApiCurriculum, ApiCurriculumDay, ApiCurriculumWeek, ApiModule, ApiModuleEvent, ApiSyllabus } from "@/api-shared/types/gantt/api-layer";

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
export enum DayIndex
{
    Sunday = 0,
    Monday = 1,
    Tuesday = 2,
    Wednesday = 3,
    Thursday = 4,
    Friday = 5,
    Saturday = 6,
}

export const DAY_NAME_DISPLAY: Record<DayIndex, string> = {
    [ DayIndex.Sunday ]: 'ראשון',
    [ DayIndex.Monday ]: 'שני',
    [ DayIndex.Tuesday ]: 'שלישי',
    [ DayIndex.Wednesday ]: 'רביעי',
    [ DayIndex.Thursday ]: 'חמישי',
    [ DayIndex.Friday ]: 'שישי',
    [ DayIndex.Saturday ]: 'שבת',
};

export function getDayNameDisplay(day: DayIndex): string
{
    return DAY_NAME_DISPLAY[ day ] ?? '';
}
export interface CurriculumDay extends BaseGantItem
{
    readonly title: string;  // Generated from day name
    weekId: CurriculumWeekId;
    dayIndex: DayIndex;
    totalWorkingMinutes: number;
    comment?: string;
}
export type CurriculumDayId = string;

export interface CurriculumWeek extends BaseGantItem
{
    readonly title: string;  // Generated from week number
    number: number;
    days: Array<CurriculumDayId>;
    comment?: string;
    weekendDuty: boolean;
}
export type CurriculumWeekId = string;

export interface Curriculum extends BaseGantItem
{
    title: string;
    description: string;
    syllabuses: Array<SyllabusId>;
    isDraft: boolean;
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
        isDraft: curriculum?.isDraft ?? true,
        weeks: curriculum?.weeks ?? [],
    };
}

export type ApiT<T> =
    T extends Curriculum ? ApiCurriculum :
    T extends Syllabus ? ApiSyllabus :
    T extends Module ? ApiModule :
    T extends ModuleEvent ? ApiModuleEvent :
    T extends CurriculumWeek ? ApiCurriculumWeek :
    T extends CurriculumDay ? ApiCurriculumDay :
    never;
