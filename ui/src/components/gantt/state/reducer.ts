import dayjs from "dayjs";

import { BaseDocument } from "@/api-client/gantt/base";
import {
    NormalizedStore,
    normalizeCurriculumData,
} from "@/api-client/gantt/drizzle-normalize";
import {
    AllocateTimeToEventCallback,
    allocateTimeToModule,
} from "@/api-shared/gantt/allocate-time";
import { ApiCurriculum } from "@/api-shared/types/gantt/api-layer";
import {
    BaseGantItem,
    GanttCurriculum,
    GanttCurriculumId,
    GanttDay,
    GanttDayId,
    GanttEvent,
    GanttEventId,
    GanttModule,
    GanttModuleId,
    GanttSyllabus,
    GanttSyllabusId,
    GanttWeek,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";

export type Action =
    | { type: "ADD_DAY"; payload: { day: GanttDay & { id: GanttDayId } } }

    // Updates
    | {
          type: "ADD_EVENT";
          payload: { moduleId: GanttModuleId; event: GanttEvent };
      }
    | {
          type: "ADD_MODULE";
          payload: { syllabusId: GanttSyllabusId; module: GanttModule };
      }
    | {
          type: "ADD_SYLLABUS";
          payload: { curriculumId: GanttCurriculumId; syllabus: GanttSyllabus };
      }
    | {
          type: "ADD_WEEK";
          payload: {
              week: GanttWeek & { id: GanttWeekId };
              curriculumId: GanttCurriculumId;
          };
      }

    // Adds
    | {
          type: "ALLOCATE_TIME_TO_MODULE";
          payload: {
              curriculumId: GanttCurriculumId;
              moduleId: GanttModuleId;
              duration: number;
          };
      }
    | {
          type: "ALLOCATE_TIME";
          payload: {
              curriculumId: GanttCurriculumId;
              eventId: GanttEventId;
              duration: number;
          };
      }
    | { type: "REMOVE_DAY"; payload: { dayId: GanttDayId } }

    // Removes
    | {
          type: "REMOVE_EVENT";
          payload: { moduleId: GanttModuleId; eventId: GanttEventId };
      }
    | {
          type: "REMOVE_MODULE";
          payload: { syllabusId: GanttSyllabusId; moduleId: GanttModuleId };
      }
    | {
          type: "REMOVE_SYLLABUS";
          payload: {
              curriculumId: GanttCurriculumId;
              syllabusId: GanttSyllabusId;
          };
      }
    | {
          type: "REMOVE_WEEK";
          payload: { weekId: GanttWeekId; curriculumId: GanttCurriculumId };
      }
    | { type: "SET_DATA"; payload: ApiCurriculum }
    | {
          type: "UPDATE_CURRICULUM";
          payload: { id: GanttCurriculumId; updates: Partial<GanttCurriculum> };
      }
    | {
          type: "UPDATE_DAY";
          payload: { id: GanttDayId; updates: Partial<GanttDay> };
      }
    | {
          type: "UPDATE_EVENT";
          payload: { id: GanttEventId; updates: Partial<GanttEvent> };
      }
    | {
          type: "UPDATE_MODULE";
          payload: { id: GanttModuleId; updates: Partial<GanttModule> };
      }
    | {
          type: "UPDATE_SYLLABUS";
          payload: { id: GanttSyllabusId; updates: Partial<GanttSyllabus> };
      }
    | { type: "UPDATE_WEEK"; payload: { id: GanttWeekId; updates: any } };

function injectDocumentTimes<T extends BaseGantItem>(
    rawDoc: T,
): T & BaseDocument {
    return { ...rawDoc, createdAt: dayjs(), updatedAt: dayjs() };
}

export function curriculumReducer(
    state: NormalizedStore,
    action: Action,
): NormalizedStore {
    switch (action.type) {
        case "SET_DATA":
            return normalizeCurriculumData(action.payload);

        case "UPDATE_CURRICULUM": {
            const existing = state.curriculums[action.payload.id];
            if (!existing) return state;
            return {
                ...state,
                curriculums: {
                    ...state.curriculums,
                    [action.payload.id]: {
                        ...existing,
                        ...action.payload.updates,
                    },
                },
            };
        }

        case "UPDATE_SYLLABUS": {
            const existing = state.syllabuses[action.payload.id];
            if (!existing) return state;
            return {
                ...state,
                syllabuses: {
                    ...state.syllabuses,
                    [action.payload.id]: {
                        ...existing,
                        ...action.payload.updates,
                    },
                },
            };
        }

        case "UPDATE_MODULE": {
            const existing = state.modules[action.payload.id];
            if (!existing) return state;
            return {
                ...state,
                modules: {
                    ...state.modules,
                    [action.payload.id]: {
                        ...existing,
                        ...action.payload.updates,
                    },
                },
            };
        }

        case "UPDATE_EVENT": {
            const existing = state.events[action.payload.id];
            if (!existing) return state;
            return {
                ...state,
                events: {
                    ...state.events,
                    [action.payload.id]: {
                        ...existing,
                        ...action.payload.updates,
                    },
                },
            };
        }

        case "UPDATE_WEEK": {
            const existing = state.weeks[action.payload.id];
            if (!existing) return state;
            return {
                ...state,
                weeks: {
                    ...state.weeks,
                    [action.payload.id]: {
                        ...existing,
                        ...action.payload.updates,
                    },
                },
            };
        }

        case "UPDATE_DAY": {
            const existing = state.days[action.payload.id];
            if (!existing) return state;
            return {
                ...state,
                days: {
                    ...state.days,
                    [action.payload.id]: {
                        ...existing,
                        ...action.payload.updates,
                    },
                },
            };
        }

        case "ALLOCATE_TIME": {
            const existing = state.events[action.payload.eventId];
            if (!existing) return state;
            return {
                ...state,
                events: {
                    ...state.events,
                    [action.payload.eventId]: {
                        ...existing,
                        allocatedDuration: action.payload.duration,
                    },
                },
            };
        }

        case "ALLOCATE_TIME_TO_MODULE": {
            const moduleDoc = state.modules[action.payload.moduleId];
            if (!moduleDoc) return state;

            const updatedEvents = state.events;

            const updateModuleEvent: AllocateTimeToEventCallback = ({
                eventId,
                duration,
            }) => {
                const eventDoc = state.events[eventId];
                if (!eventDoc) return;
                updatedEvents[eventId] = {
                    ...eventDoc,
                    allocatedDuration: duration,
                };
            };

            allocateTimeToModule({
                module: moduleDoc,
                totalDuration: action.payload.duration,
                curriculumId: action.payload.curriculumId,
                moduleEvents: state.events,
                allocateToEventCallback: updateModuleEvent,
            });

            return { ...state, events: updatedEvents };
        }

        case "ADD_SYLLABUS": {
            const parent = state.curriculums[action.payload.curriculumId];
            if (!parent) return state;
            return {
                ...state,
                syllabuses: {
                    ...state.syllabuses,
                    [action.payload.syllabus.id]: injectDocumentTimes({
                        ...action.payload.syllabus,
                        curriculumId: parent.id,
                    }),
                },
                curriculums: {
                    ...state.curriculums,
                    [parent.id]: {
                        ...parent,
                        syllabuses: [
                            ...parent.syllabuses,
                            action.payload.syllabus.id,
                        ],
                    },
                },
            };
        }

        case "ADD_MODULE": {
            const parent = state.syllabuses[action.payload.syllabusId];
            if (!parent) return state;
            return {
                ...state,
                modules: {
                    ...state.modules,
                    [action.payload.module.id]: injectDocumentTimes({
                        ...action.payload.module,
                        syllabusId: parent.id,
                    }),
                },
                syllabuses: {
                    ...state.syllabuses,
                    [parent.id]: {
                        ...parent,
                        modules: [...parent.modules, action.payload.module.id],
                    },
                },
            };
        }

        case "ADD_EVENT": {
            const parent = state.modules[action.payload.moduleId];
            if (!parent) return state;
            return {
                ...state,
                events: {
                    ...state.events,
                    [action.payload.event.id]: injectDocumentTimes({
                        ...action.payload.event,
                        moduleId: parent.id,
                    }),
                },
                modules: {
                    ...state.modules,
                    [parent.id]: {
                        ...parent,
                        events: [...parent.events, action.payload.event.id],
                    },
                },
            };
        }

        case "REMOVE_SYLLABUS": {
            const parent = state.curriculums[action.payload.curriculumId];
            if (!parent) return state;
            return {
                ...state,
                curriculums: {
                    ...state.curriculums,
                    [parent.id]: {
                        ...parent,
                        syllabuses: parent.syllabuses.filter(
                            (id) => id !== action.payload.syllabusId,
                        ),
                    },
                },
            };
        }

        case "REMOVE_MODULE": {
            const parent = state.syllabuses[action.payload.syllabusId];
            if (!parent) return state;
            return {
                ...state,
                syllabuses: {
                    ...state.syllabuses,
                    [parent.id]: {
                        ...parent,
                        modules: parent.modules.filter(
                            (id) => id !== action.payload.moduleId,
                        ),
                    },
                },
            };
        }

        case "REMOVE_EVENT": {
            const parent = state.modules[action.payload.moduleId];
            if (!parent) return state;
            return {
                ...state,
                modules: {
                    ...state.modules,
                    [parent.id]: {
                        ...parent,
                        events: parent.events.filter(
                            (id) => id !== action.payload.eventId,
                        ),
                    },
                },
            };
        }

        case "ADD_WEEK": {
            const weeksRecord = state.weeks;
            return {
                ...state,
                weeks: {
                    ...weeksRecord,
                    [action.payload.week.id]: injectDocumentTimes({
                        ...action.payload.week,
                        curriculumId: action.payload.curriculumId,
                    }) as any,
                },
                curriculums: {
                    ...state.curriculums,
                    [action.payload.curriculumId]: {
                        ...state.curriculums[action.payload.curriculumId],
                        weeks: [
                            ...state.curriculums[action.payload.curriculumId]
                                .weeks,
                            action.payload.week.id,
                        ],
                    },
                },
            };
        }

        case "REMOVE_WEEK": {
            const existingWeek = state.weeks[action.payload.weekId];
            const { [action.payload.weekId]: _, ...remainingWeeks } =
                state.weeks;
            const remainingDays = { ...state.days };

            for (const dayId of existingWeek?.days ?? []) {
                delete remainingDays[dayId];
            }

            const parent = state.curriculums[action.payload.curriculumId];

            return {
                ...state,
                weeks: remainingWeeks,
                days: remainingDays,
                curriculums: parent
                    ? {
                          ...state.curriculums,
                          [parent.id]: {
                              ...parent,
                              weeks: parent.weeks.filter(
                                  (weekId) => weekId !== action.payload.weekId,
                              ),
                          },
                      }
                    : state.curriculums,
            };
        }

        case "ADD_DAY": {
            const daysRecord = state.days as Record<
                GanttDayId,
                GanttDay & { id: GanttDayId }
            >;
            return {
                ...state,
                days: {
                    ...daysRecord,
                    [action.payload.day.id]: injectDocumentTimes(
                        action.payload.day,
                    ) as any,
                } as typeof state.days,
            };
        }

        case "REMOVE_DAY": {
            const { [action.payload.dayId]: _, ...remainingDays } = state.days;
            return {
                ...state,
                days: remainingDays,
            };
        }

        default:
            return state;
    }
}
