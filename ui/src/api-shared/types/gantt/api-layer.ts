import {
    BaseGantItem,
    GanttCurriculum,
    GanttCurriculumId,
} from "@/api-shared/types/gantt/models";
import { GanttDay, GanttDayId } from "@/api-shared/types/gantt/models/day";
import {
    GanttEvent,
    GanttEventId,
} from "@/api-shared/types/gantt/models/event";
import {
    GanttModule,
    GanttModuleId,
} from "@/api-shared/types/gantt/models/module";
import {
    GanttSyllabus,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models/syllabus";
import { GanttWeek, GanttWeekId } from "@/api-shared/types/gantt/models/week";

/**
 * A document as it comes off the wire: timestamps are still ISO strings, before
 * the client's date fixup turns them into Dayjs. Lives here rather than in
 * `api-client` because `api-shared` describes the wire shape and must not
 * depend on either side of it.
 */
export type RawBaseDocument = {
    createdAt: string;
    updatedAt: string;
};

/**
 * The DB-facing operations a Gantt entity must provide for the generic
 * collection/item route builders. Declared here so `api-server` can implement
 * it without importing from the route layer that consumes it.
 */
export type BasicGantOperations<
    TEntity extends BaseGantItem,
    TCreatePayload = Omit<TEntity, "id">,
> = {
    listItems: (
        withParents?: boolean,
    ) => Promise<
        | Record<TEntity["id"], { title: TEntity["title"] }>
        | Record<TEntity["id"], TEntity["title"]>
    >;
    getMultipleItems: (ids: Array<string>) => Promise<Array<TEntity>>;
    getItem: (id: TEntity["id"]) => Promise<any>;
    createNewItem: (
        payload: TCreatePayload,
    ) => Promise<ApiT<TEntity> | TEntity>; // TODO: This should always be ApiT<TEntity>
    updateItem: (
        id: TEntity["id"],
        updates: Partial<TEntity>,
    ) => Promise<TEntity>;
    deleteItem: (id: TEntity["id"]) => Promise<void>;
};

export type ApiModuleEvent = {
    cEC: Array<{
        eventId: GanttEventId;
        curriculumId: GanttCurriculumId;
        allocatedDuration: number;
    }>;
} & Omit<GanttEvent & RawBaseDocument, "allocatedDuration" | "constraints">;

export type ApiModule = {
    m2e: Array<{
        moduleId: GanttModuleId;
        eventId: GanttEventId;
        event: ApiModuleEvent;
    }>;
} & Omit<GanttModule & RawBaseDocument, "constraints" | "events">;

export type ApiSyllabus = {
    s2m: Array<{
        syllabusId: GanttSyllabusId;
        moduleId: GanttModuleId;
        module: ApiModule;
    }>;
} & Omit<GanttSyllabus & RawBaseDocument, "modules">;

export type ApiCurriculumDay = {} & Omit<GanttDay & RawBaseDocument, "title">;

export type ApiCurriculumWeek = {
    w2d: Array<{
        weekId: GanttWeekId;
        dayId: GanttDayId;
        day: ApiCurriculumDay;
    }>;
} & Omit<GanttWeek & RawBaseDocument, "days">;

export type ApiCurriculum = {
    c2s: Array<{
        curriculumId: GanttCurriculumId;
        syllabusId: GanttSyllabusId;
        syllabus: ApiSyllabus;
    }>;
    c2w: Array<{
        curriculumId: GanttCurriculumId;
        weekId: GanttWeekId;
        week: ApiCurriculumWeek;
    }>;
} & Omit<GanttCurriculum & RawBaseDocument, "syllabuses" | "weeks">;

export type ApiT<T> = T extends GanttCurriculum
    ? ApiCurriculum
    : T extends GanttSyllabus
      ? ApiSyllabus
      : T extends GanttModule
        ? ApiModule
        : T extends GanttEvent
          ? ApiModuleEvent
          : T extends GanttWeek
            ? ApiCurriculumWeek
            : T extends GanttDay
              ? ApiCurriculumDay
              : never;
