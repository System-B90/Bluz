import { useSnackbar } from "notistack";
import { ReactNode, useCallback, useEffect, useMemo, useReducer } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { ganttApi } from "@/api-client/gantt";
import { BaseDbDocument } from "@/api-server/gantt/db-base";
import {
    GanttCurriculumId,
    GanttCurriculumModuleDayMapping,
    GanttDayId,
    GanttEventId,
    GanttModuleId,
} from "@/api-shared/types/gantt/models";
import { GanttMappingContext } from "@/components/gantt/state/mappings/context";
import { ganttMappingReducer } from "@/components/gantt/state/mappings/reducer";
import { getGanttMappingKey } from "@/components/gantt/state/mappings/types";

export function GanttMappingProvider({
    children,
    curriculumId,
}: {
    children: ReactNode;
    curriculumId: GanttCurriculumId;
}) {
    const { enqueueSnackbar } = useSnackbar();
    const [state, dispatch] = useReducer(ganttMappingReducer, {
        mappings: {},
        isLoading: true,
    });

    const refreshMappings = useCallback(async () => {
        dispatch({ type: "SET_LOADING", payload: true });
        const data = await ganttApi.mappings.apiGet(curriculumId);
        dispatch({ type: "SET_MAPPINGS", payload: data }); // Internally sets loading state to false
    }, [dispatch, curriculumId]);

    /**
     * createMapping: Handles assigning a module to a day for the first time.
     */
    const createMapping = useCallback(
        async ({
            moduleId,
            eventId,
            dayId,
        }: {
            moduleId: GanttModuleId;
            eventId: GanttEventId | null;
            dayId: GanttDayId;
        }) => {
            const tempSortOrder = Date.now();
            const optimisticMapping: GanttCurriculumModuleDayMapping &
                BaseDbDocument = {
                    curriculumId,
                    moduleId,
                    eventId,
                    dayId,
                    sortOrder: tempSortOrder,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                };

            // Optimistic UI Update
            dispatch({ type: "UPSERT_MAPPING", payload: optimisticMapping });

            try {
                const result = await ganttApi.mappings.apiCreate(curriculumId, {
                    moduleId,
                    eventId,
                    dayId,
                    sortOrder: tempSortOrder,
                });
                // Update with the actual data from the server (e.g., if IDs or timestamps were generated)
                dispatch({ type: "UPSERT_MAPPING", payload: result });

                return result;
            } catch (e) {
                // Rollback on failure
                dispatch({
                    type: "DELETE_MAPPING",
                    payload: { dayId, moduleId, eventId },
                });
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "יצירת המיפוי נכשלה!",
                    e,
                );
            }
        },
        [dispatch, curriculumId, enqueueSnackbar],
    );

    const moveMapping = useCallback(
        async ({
            moduleId,
            eventId,
            from,
            to,
        }: {
            moduleId: GanttModuleId;
            eventId: GanttEventId | null;
            from: { d: GanttDayId };
            to: { d: GanttDayId };
        }) => {
            // Optimistic UI Update
            const oldKey = getGanttMappingKey({
                dayId: from.d,
                moduleId,
                eventId,
            });
            const originalMapping = state.mappings[oldKey];

            if (!originalMapping) return;

            const updatedMapping = { ...originalMapping, dayId: to.d };

            dispatch({
                type: "DELETE_MAPPING",
                payload: { dayId: from.d, moduleId, eventId },
            });
            dispatch({ type: "UPSERT_MAPPING", payload: updatedMapping });

            try {
                await ganttApi.mappings.apiUpdate(
                    curriculumId,
                    moduleId,
                    eventId,
                    { dayId: from.d },
                    { dayId: to.d },
                );
            } catch (e) {
                // Rollback on failure
                dispatch({
                    type: "DELETE_MAPPING",
                    payload: { dayId: to.d, moduleId, eventId },
                });
                dispatch({ type: "UPSERT_MAPPING", payload: originalMapping });

                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון המיפוי נכשל!",
                    e,
                );
            }
        },
        [state.mappings, curriculumId, dispatch, enqueueSnackbar],
    );

    const removeMapping = useCallback(
        async ({
            moduleId,
            eventId,
            dayId,
        }: {
            moduleId: GanttModuleId;
            eventId: GanttEventId | null;
            dayId: GanttDayId;
        }) => {
            dispatch({
                type: "DELETE_MAPPING",
                payload: { dayId, moduleId, eventId },
            });
            try {
                await ganttApi.mappings.apiDelete(
                    curriculumId,
                    moduleId,
                    eventId,
                    dayId,
                );
            } catch (e) {
                await refreshMappings(); // Re-sync on failure
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "מחיקת המיפוי נכשלה!",
                    e,
                );
            }
        },
        [refreshMappings, dispatch, curriculumId, enqueueSnackbar],
    );

    useEffect(() => {
        refreshMappings().catch((error) =>
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "טעינת מיפויי מערכים ומופעים נכשלה!",
                error,
            ),
        );
    }, [enqueueSnackbar, refreshMappings]); // Initial load

    const value = useMemo(
        () => ({
            state,
            refreshMappings,
            moveMapping,
            removeMapping,
            createMapping,
        }),
        [state, refreshMappings, moveMapping, removeMapping, createMapping],
    );

    return (
        <GanttMappingContext.Provider value={value}>
            {children}
        </GanttMappingContext.Provider>
    );
}
