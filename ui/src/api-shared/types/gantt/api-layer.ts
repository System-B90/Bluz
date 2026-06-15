import { RawBaseDocument } from "@/api-client/gantt/base";
import {
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
