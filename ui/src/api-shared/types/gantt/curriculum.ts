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
export interface GanttEvent extends BaseGantItem 
{
    title: string;
    type: ModuleEventType;
    minimumDuration: number;
    allocatedDuration: number;
    requirements: Array<ModuleEventRequirements>;
}
export type GanttEventId = GanttEvent[ 'id' ];
export interface GanttModule extends BaseGantItem
{
    title: string;
    description: string;
    events: Array<GanttEventId>;
    hiveIds: Array<number>;
}
export type GanttModuleId = GanttModule[ 'id' ];
export interface GanttSyllabus extends BaseGantItem
{
    title: string;
    hiveIds: Array<number>;
    modules: Array<GanttModuleId>;
}
export type GanttSyllabusId = GanttSyllabus[ 'id' ];
export enum GanttDayIndex
{
    Sunday = 0,
    Monday = 1,
    Tuesday = 2,
    Wednesday = 3,
    Thursday = 4,
    Friday = 5,
    Saturday = 6,
}

export const DAY_NAME_DISPLAY: Record<GanttDayIndex, string> = {
    [ GanttDayIndex.Sunday ]: 'ראשון',
    [ GanttDayIndex.Monday ]: 'שני',
    [ GanttDayIndex.Tuesday ]: 'שלישי',
    [ GanttDayIndex.Wednesday ]: 'רביעי',
    [ GanttDayIndex.Thursday ]: 'חמישי',
    [ GanttDayIndex.Friday ]: 'שישי',
    [ GanttDayIndex.Saturday ]: 'שבת',
};

export function getDayNameDisplay(day: GanttDayIndex): string
{
    return DAY_NAME_DISPLAY[ day ] ?? '';
}
export interface GanttDay extends BaseGantItem
{
    readonly title: string;  // Generated from day name
    weekId: GanttWeekId;
    dayIndex: GanttDayIndex;
    totalWorkingMinutes: number;
    comment?: string;
}
export type GanttDayId = string;

export interface GanttWeek extends BaseGantItem
{
    readonly title: string;  // Generated from week number
    number: number;
    days: Array<GanttDayId>;
    comment?: string;
    weekendDuty: boolean;
}
export type GanttWeekId = string;

export interface GanttCurriculum extends BaseGantItem
{
    title: string;
    description: string;
    syllabuses: Array<GanttSyllabusId>;
    isDraft: boolean;
    weeks: Array<GanttWeekId>;
}
export type GanttCurriculumId = GanttCurriculum[ 'id' ];

type MakerReturnType<T extends BaseGantItem> = Omit<T, 'id'> & { id: T[ 'id' ] | undefined; };

export function makeCurriculum(curriculum?: Partial<GanttCurriculum>): MakerReturnType<GanttCurriculum>
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
    T extends GanttCurriculum ? ApiCurriculum :
    T extends GanttSyllabus ? ApiSyllabus :
    T extends GanttModule ? ApiModule :
    T extends GanttEvent ? ApiModuleEvent :
    T extends GanttWeek ? ApiCurriculumWeek :
    T extends GanttDay ? ApiCurriculumDay :
    never;
