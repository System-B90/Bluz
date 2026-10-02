import { requireCurriculumId, CURRICULUM_ID_PARAM } from "@/api-server/ai/tools/gantt";
import { AiTool } from "@/api-server/ai/tools/types";
import {
    createCurriculumModuleDayMapping,
    getModuleDayMappingsForCurriculum,
    updateCurriculumModuleDayMapping,
} from "@/api-server/gantt/db-mappings";
import { AiToolDanger, AiToolKind } from "@/api-shared/types/ai";
import {
    GanttCurriculumId,
    GanttDayId,
    GanttEventId,
    GanttModuleId,
} from "@/api-shared/types/gantt/models";

const idParam = (description: string) => ({ type: "string", description });

/**
 * AI write for an event's allotted time (#857). An event's scheduled time is
 * the sum of `allottedMinutes` over its (curriculum, event, day) mappings, so
 * the tool sets one mapping's minutes, placing the event on that day first
 * when it is not there yet. 0 keeps the mapping but leaves the event out of
 * the cut, exactly like the grid.
 */
export type SetAllottedTimeArgs = {
    curriculumId?: string;
    moduleId: string;
    eventId: string;
    dayId: string;
    minutes: number;
};

async function existingMapping(curriculumId: GanttCurriculumId, args: SetAllottedTimeArgs) {
    const mappings = await getModuleDayMappingsForCurriculum(curriculumId, { dayIds: [ args.dayId as GanttDayId ] });
    return mappings.find((m) => m.eventId === args.eventId && m.moduleId === args.moduleId);
}

export const setGanttEventAllottedTimeTool: AiTool<SetAllottedTimeArgs> = {
    name: "set_gantt_event_allotted_time",
    title: "הקצאת זמן למופע ביום",
    danger: AiToolDanger.Caution,
    kind: AiToolKind.Write,
    description:
        "קובע כמה דקות מוקצות למופע ביום מסוים בגאנט (allottedMinutes). "
        + "הזמן הכולל של מופע הוא סכום הדקות בכל הימים שהוא משובץ בהם. "
        + "אם המופע לא משובץ ביום — הוא ישובץ בו. 0 משאיר שיבוץ אבל מוציא אותו מהגזירה.",
    parameters: {
        type: "object",
        properties: {
            curriculumId: CURRICULUM_ID_PARAM,
            moduleId: idParam("מזהה המערך של המופע"),
            eventId: idParam("מזהה המופע"),
            dayId: idParam("מזהה היום בגאנט (list_days)"),
            minutes: { type: "integer", minimum: 0, maximum: 24 * 60 },
        },
        required: [ "moduleId", "eventId", "dayId", "minutes" ],
        additionalProperties: false,
    },
    describe: (args) => `הקצאת ${args.minutes} דקות למופע ${args.eventId} ביום ${args.dayId}`,
    impact: (args) => [
        `למופע יוקצו ${args.minutes} דקות ביום הזה. אם אינו משובץ בו — ישובץ.`,
        ...(args.minutes === 0 ? [ "0 דקות: המופע יישאר בציר הזמן אך לא ייכלל בגזירה." ] : []),
    ],
    async execute(args, context) {
        const curriculumId = requireCurriculumId(args, context) as GanttCurriculumId;
        const existing = await existingMapping(curriculumId, args);
        if (existing) {
            await updateCurriculumModuleDayMapping(
                curriculumId,
                args.moduleId as GanttModuleId,
                args.eventId as GanttEventId,
                { dayId: args.dayId as GanttDayId },
                { allottedMinutes: args.minutes },
            );
        } else {
            await createCurriculumModuleDayMapping({
                curriculumId,
                moduleId: args.moduleId as GanttModuleId,
                eventId: args.eventId as GanttEventId,
                dayId: args.dayId as GanttDayId,
                allottedMinutes: args.minutes,
            });
        }
        return {
            data: {
                ...args,
                curriculumId,
                previousMinutes: existing ? existing.allottedMinutes : null,
                placed: !existing,
            },
            summary: existing
                ? `הזמן המוקצה עודכן מ-${existing.allottedMinutes} ל-${args.minutes} דקות`
                : `המופע שובץ ביום עם ${args.minutes} דקות`,
        };
    },
};
