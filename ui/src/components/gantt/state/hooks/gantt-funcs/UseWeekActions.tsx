import { useCallback } from "react";

import { ganttApi } from "@/api-client/gantt";
import
{
    CreateGanttDayPayload,
    CreateGanttWeekPayload,
} from "@/api-shared/types/gantt/create-payloads";
import
{
    GanttCurriculumId,
    GanttDay,
    GanttDayId,
    GanttWeek,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";
import { withGantErrorHandling } from "@/components/gantt/state/hooks/gantt-funcs/WithGantErrorHandling";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

export interface UseWeekActionsReturn
{
    createWeek: (payload: CreateGanttWeekPayload) => Promise<GanttWeek>;
    updateWeek: (
        weekId: GanttWeekId,
        updates: Partial<{ comment?: string; weekendDuty?: boolean; }>,
    ) => Promise<GanttWeek>;
    deleteWeek: (weekId: GanttWeekId, curriculumId: GanttCurriculumId) => Promise<void>;
    createDay: (payload: CreateGanttDayPayload) => Promise<GanttDay>;
    updateDay: (
        dayId: GanttDayId,
        updates: Partial<GanttDay>,
    ) => Promise<GanttDay>;
    deleteDay: (dayId: GanttDayId) => Promise<void>;
}

export function useWeekActions(): UseWeekActionsReturn
{
    const { dispatch } = useCurriculumProviderActions();

    const createWeek = useCallback(
        async (payload: CreateGanttWeekPayload) =>
        {
            return withGantErrorHandling(async () =>
            {
                const newWeek = await ganttApi.week.apiCreate(payload);
                dispatch({ type: "ADD_WEEK", payload: { week: newWeek, curriculumId: payload.curriculumId } });
                return newWeek;
            }, "Failed to create week:");
        },
        [ dispatch ],
    );

    const updateWeek = useCallback(
        async (
            weekId: GanttWeekId,
            updates: Partial<{ comment?: string; weekendDuty?: boolean; }>,
        ) =>
        {
            return withGantErrorHandling(async () =>
            {
                const updatedWeek = await ganttApi.week.apiUpdate({
                    id: weekId,
                    ...updates,
                });
                dispatch({
                    type: "UPDATE_WEEK",
                    payload: { id: weekId, updates: updatedWeek },
                });
                return updatedWeek;
            }, `Failed to update week (ID: ${weekId}):`);
        },
        [ dispatch ],
    );

    const deleteWeek = useCallback(
        async (weekId: GanttWeekId, curriculumId: GanttCurriculumId) =>
        {
            return withGantErrorHandling(async () =>
            {
                await ganttApi.week.apiDelete(weekId);
                dispatch({ type: "REMOVE_WEEK", payload: { weekId, curriculumId } });
            }, `Failed to delete week (ID: ${weekId}):`);
        },
        [ dispatch ],
    );

    const createDay = useCallback(
        async (payload: CreateGanttDayPayload) =>
        {
            return withGantErrorHandling(async () =>
            {
                const newDay = await ganttApi.day.apiCreate(payload);
                dispatch({ type: "ADD_DAY", payload: { day: newDay } });
                return newDay;
            }, "Failed to create day:");
        },
        [ dispatch ],
    );

    const updateDay = useCallback(
        async (dayId: GanttDayId, updates: Partial<GanttDay>) =>
        {
            return withGantErrorHandling(async () =>
            {
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
        [ dispatch ],
    );

    const deleteDay = useCallback(
        async (dayId: GanttDayId) =>
        {
            return withGantErrorHandling(async () =>
            {
                await ganttApi.day.apiDelete(dayId);
                dispatch({ type: "REMOVE_DAY", payload: { dayId } });
            }, `Failed to delete day (ID: ${dayId}):`);
        },
        [ dispatch ],
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
