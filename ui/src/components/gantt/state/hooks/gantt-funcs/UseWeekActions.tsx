import { useCallback } from "react";

import { ganttApi } from "@/api-client/gantt";
import { ApiCurriculumWeek } from "@/api-shared/types/gantt/api-layer";
import {
    CreateGanttDayPayload,
    CreateGanttWeekPayload,
} from "@/api-shared/types/gantt/create-payloads";
import {
    DAY_NAME_DISPLAY,
    GanttCurriculumId,
    GanttDay,
    GanttDayId,
    GanttWeek,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";
import { withGantErrorHandling } from "@/components/gantt/state/hooks/gantt-funcs/WithGantErrorHandling";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

export type UseWeekActionsReturn = {
    createWeek: (payload: CreateGanttWeekPayload) => Promise<GanttWeek>;
    updateWeek: (
        weekId: GanttWeekId,
        updates: Partial<{ comment?: string; weekendDuty?: boolean }>,
    ) => Promise<GanttWeek>;
    deleteWeek: (
        weekId: GanttWeekId,
        curriculumId: GanttCurriculumId,
    ) => Promise<void>;
    createDay: (payload: CreateGanttDayPayload) => Promise<GanttDay>;
    updateDay: (
        dayId: GanttDayId,
        updates: Partial<GanttDay>,
    ) => Promise<GanttDay>;
    deleteDay: (dayId: GanttDayId) => Promise<void>;
};

export function useWeekActions(): UseWeekActionsReturn {
    const { dispatch } = useCurriculumProviderActions();

    const createWeek = useCallback(
        async (payload: CreateGanttWeekPayload) => {
            return await withGantErrorHandling(async () => {
                const newWeek = await ganttApi.week.apiCreate(payload);
                const apiWeek = newWeek as unknown as ApiCurriculumWeek;
                const linkedDays = [...(apiWeek.w2d ?? [])].sort(
                    (a, b) => a.day.dayIndex - b.day.dayIndex,
                );

                for (const dayLink of linkedDays) {
                    dispatch({
                        type: "ADD_DAY",
                        payload: {
                            day: {
                                id: dayLink.day.id,
                                title:
                                    DAY_NAME_DISPLAY[dayLink.day.dayIndex] ??
                                    `יום ${dayLink.day.dayIndex + 1}`,
                                weekId: dayLink.weekId,
                                dayIndex: dayLink.day.dayIndex,
                                totalWorkingMinutes:
                                    dayLink.day.totalWorkingMinutes,
                                comment: dayLink.day.comment,
                            },
                        },
                    });
                }

                dispatch({
                    type: "ADD_WEEK",
                    payload: {
                        week: {
                            id: apiWeek.id,
                            title: `שבוע ${apiWeek.number}`,
                            number: apiWeek.number,
                            days: linkedDays.map((dayLink) => dayLink.dayId),
                            comment: apiWeek.comment,
                            weekendDuty: apiWeek.weekendDuty,
                        },
                        curriculumId: payload.curriculumId,
                    },
                });
                return newWeek;
            }, "Failed to create week:");
        },
        [dispatch],
    );

    const updateWeek = useCallback(
        async (
            weekId: GanttWeekId,
            updates: Partial<{ comment?: string; weekendDuty?: boolean }>,
        ) => {
            return await withGantErrorHandling(async () => {
                const updatedWeek = await ganttApi.week.apiUpdate({
                    id: weekId,
                    ...updates,
                });
                const { comment, weekendDuty } = updatedWeek;
                dispatch({
                    type: "UPDATE_WEEK",
                    payload: { id: weekId, updates: { comment, weekendDuty } },
                });
                return updatedWeek;
            }, `Failed to update week (ID: ${weekId}):`);
        },
        [dispatch],
    );

    const deleteWeek = useCallback(
        async (weekId: GanttWeekId, curriculumId: GanttCurriculumId) => {
            return await withGantErrorHandling(async () => {
                await ganttApi.week.apiDelete(weekId);
                dispatch({
                    type: "REMOVE_WEEK",
                    payload: { weekId, curriculumId },
                });
            }, `Failed to delete week (ID: ${weekId}):`);
        },
        [dispatch],
    );

    const createDay = useCallback(
        async (payload: CreateGanttDayPayload) => {
            return await withGantErrorHandling(async () => {
                const newDay = await ganttApi.day.apiCreate(payload);
                dispatch({ type: "ADD_DAY", payload: { day: newDay } });
                return newDay;
            }, "Failed to create day:");
        },
        [dispatch],
    );

    const updateDay = useCallback(
        async (dayId: GanttDayId, updates: Partial<GanttDay>) => {
            return await withGantErrorHandling(async () => {
                const updatedDay = await ganttApi.day.apiUpdate({
                    id: dayId,
                    ...updates,
                });
                dispatch({
                    type: "UPDATE_DAY",
                    payload: { id: dayId, updates: updatedDay },
                });
                return updatedDay;
            }, `Failed to update day (ID: ${dayId}):`);
        },
        [dispatch],
    );

    const deleteDay = useCallback(
        async (dayId: GanttDayId) => {
            return await withGantErrorHandling(async () => {
                await ganttApi.day.apiDelete(dayId);
                dispatch({ type: "REMOVE_DAY", payload: { dayId } });
            }, `Failed to delete day (ID: ${dayId}):`);
        },
        [dispatch],
    );

    return {
        createWeek,
        updateWeek,
        deleteWeek,
        createDay,
        updateDay,
        deleteDay,
    } as const;
}
