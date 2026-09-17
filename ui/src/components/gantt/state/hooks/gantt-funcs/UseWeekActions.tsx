import { useCallback, useEffect, useRef } from "react";

import { ganttApi } from "@/api-client/gantt";
import { getDefaultWorkingMinutesForDay } from "@/api-shared/gantt/week-defaults";
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
    GanttDayIndex,
    GanttWeek,
    GanttWeekId,
} from "@/api-shared/types/gantt/models";
import { withGantErrorHandling } from "@/components/gantt/state/hooks/gantt-funcs/WithGantErrorHandling";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/provider";

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

// Server (db-week.ts createWeek) seeds every new week with these seven days.
// The optimistic pre-render mirrors that structure so the placeholder matches
// what comes back from the server, avoiding a layout jump on reconcile.
const OPTIMISTIC_DAY_INDICES: ReadonlyArray<GanttDayIndex> = [
    GanttDayIndex.Sunday,
    GanttDayIndex.Monday,
    GanttDayIndex.Tuesday,
    GanttDayIndex.Wednesday,
    GanttDayIndex.Thursday,
    GanttDayIndex.Friday,
    GanttDayIndex.Saturday,
];

export function useWeekActions(): UseWeekActionsReturn {
    const { dispatch } = useCurriculumProviderActions();

    // Keep the latest store in a ref so callbacks can read current week values
    // (for optimistic-update rollback) without being recreated each render.
    const state = useCurriculumState();
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // Per-id sequence guarding against out-of-order responses: a slow PATCH must
    // not clobber a newer edit made while it was in flight (mirrors
    // MakeEntityActions.updateSeqById).
    const updateSeqById = useRef(new Map<GanttWeekId, number>());

    const createWeek = useCallback(
        async (payload: CreateGanttWeekPayload) => {
            // Optimistically render the new week (plus its seven placeholder
            // days) immediately with temp IDs so the UI reacts without waiting
            // on the server round-trip — which also inserts the linked days and
            // so is slow. On success we swap the temp week for the real one; on
            // failure we roll the optimistic week back. Mirrors the optimistic
            // pattern already used by updateWeek below.
            const tempWeekId = `temp-week-${crypto.randomUUID()}` as GanttWeekId;
            const optimisticDays = OPTIMISTIC_DAY_INDICES.map((dayIndex) => ({
                id: `temp-day-${crypto.randomUUID()}` as GanttDayId,
                dayIndex,
                totalWorkingMinutes: getDefaultWorkingMinutesForDay(dayIndex),
            }));

            for (const day of optimisticDays) {
                dispatch({
                    type: "ADD_DAY",
                    payload: {
                        day: {
                            id: day.id,
                            title:
                                DAY_NAME_DISPLAY[day.dayIndex] ??
                                `יום ${day.dayIndex + 1}`,
                            weekId: tempWeekId,
                            dayIndex: day.dayIndex,
                            totalWorkingMinutes: day.totalWorkingMinutes,
                            comment: "",
                        },
                    },
                });
            }

            dispatch({
                type: "ADD_WEEK",
                payload: {
                    week: {
                        id: tempWeekId,
                        title: `שבוע ${payload.number}`,
                        number: payload.number,
                        days: optimisticDays.map((day) => day.id),
                        comment: payload.comment,
                        weekendDuty: payload.weekendDuty,
                    },
                    curriculumId: payload.curriculumId,
                },
            });

            try {
                const newWeek = await ganttApi.week.apiCreate(payload);
                const apiWeek = newWeek as unknown as ApiCurriculumWeek;
                const linkedDays = [...(apiWeek.w2d ?? [])].sort(
                    (a, b) => a.day.dayIndex - b.day.dayIndex,
                );

                // Drop the optimistic placeholder (REMOVE_WEEK also purges its
                // temp days) before inserting the server-backed week/days.
                dispatch({
                    type: "REMOVE_WEEK",
                    payload: {
                        weekId: tempWeekId,
                        curriculumId: payload.curriculumId,
                    },
                });

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
                                dayEndTime: dayLink.day.dayEndTime ?? null,
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
            } catch (error) {
                // Roll back the optimistic week before surfacing the error.
                dispatch({
                    type: "REMOVE_WEEK",
                    payload: {
                        weekId: tempWeekId,
                        curriculumId: payload.curriculumId,
                    },
                });
                console.error("Failed to create week:", error);
                throw error;
            }
        },
        [dispatch],
    );

    const updateWeek = useCallback(
        async (
            weekId: GanttWeekId,
            updates: Partial<{ comment?: string; weekendDuty?: boolean }>,
        ) => {
            // Optimistically apply the change so toggles/inputs react instantly
            // instead of waiting on the server round-trip. Snapshot the prior
            // values for the touched keys so we can roll back on failure.
            const seq = (updateSeqById.current.get(weekId) ?? 0) + 1;
            updateSeqById.current.set(weekId, seq);
            const isLatest = () => updateSeqById.current.get(weekId) === seq;

            const existing = stateRef.current.weeks[weekId];
            const rollback: Partial<{ comment?: string; weekendDuty?: boolean }> =
                {};
            if ("comment" in updates) rollback.comment = existing?.comment;
            if ("weekendDuty" in updates)
                rollback.weekendDuty = existing?.weekendDuty;

            dispatch({
                type: "UPDATE_WEEK",
                payload: { id: weekId, updates },
            });

            try {
                const updatedWeek = await ganttApi.week.apiUpdate({
                    id: weekId,
                    ...updates,
                });
                const { comment, weekendDuty } = updatedWeek;
                // Skip a stale response that a newer edit has already superseded.
                if (isLatest()) {
                    dispatch({
                        type: "UPDATE_WEEK",
                        payload: {
                            id: weekId,
                            updates: { comment, weekendDuty },
                        },
                    });
                }
                return updatedWeek;
            } catch (error) {
                // Revert the optimistic change, unless a newer edit is pending.
                if (isLatest()) {
                    dispatch({
                        type: "UPDATE_WEEK",
                        payload: { id: weekId, updates: rollback },
                    });
                }
                console.error(`Failed to update week (ID: ${weekId}):`, error);
                throw error;
            }
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
