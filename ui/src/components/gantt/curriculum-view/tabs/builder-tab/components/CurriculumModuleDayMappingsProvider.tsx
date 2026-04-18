/**
 * Name: CurriculumMappingProvider.tsx
 * Purpose: High-performance state management for module-to-day mappings.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { useSnackbar } from "notistack";
import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
} from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { ganttApi } from "@/api-client/gantt";
import { BaseDbDocument } from "@/api-server/gantt/db-base";
import
{
    GanttCurriculumId,
    GanttCurriculumModuleDayMapping,
    GanttDayId,
    GanttEventId,
    GanttModuleId
} from "@/api-shared/types/gantt/models";

/**
 * State Definition
 */
interface MappingState
{
    // Key: `${dayId}-${moduleId}-${eventId ?? 'null'}`
    mappings: Record<string, GanttCurriculumModuleDayMapping>;
    isLoading: boolean;
    error: null | string;
}

type MappingAction =
    | {
        type: "DELETE_MAPPING";
        payload: Pick<GanttCurriculumModuleDayMapping, 'dayId' | 'moduleId' | "eventId">;
    }
    | { type: "SET_ERROR"; payload: null | string; }
    | { type: "SET_LOADING"; payload: boolean; }
    | { type: "SET_MAPPINGS"; payload: Array<GanttCurriculumModuleDayMapping>; }
    | { type: "UPSERT_MAPPING"; payload: GanttCurriculumModuleDayMapping; };

const getMappingKey = (m: { dayId: GanttDayId; moduleId: GanttModuleId; eventId?: GanttEventId | null; }) =>
    `${m.dayId}-${m.moduleId}-${m.eventId ?? 'null'}`;

/**
 * High-Performance Reducer
 */
function mappingReducer(
    state: MappingState,
    action: MappingAction,
): MappingState
{
    switch (action.type)
    {
    case "SET_MAPPINGS":
        const newMappings: Record<string, GanttCurriculumModuleDayMapping> = {};
        action.payload.forEach((m) =>
        {
            newMappings[ getMappingKey(m) ] = m;
        });
        return { ...state, mappings: newMappings, isLoading: false };

    case "UPSERT_MAPPING":
        return {
            ...state,
            mappings: {
                ...state.mappings,
                [ getMappingKey(action.payload) ]: action.payload,
            },
        };

    case "DELETE_MAPPING":
        const updated = { ...state.mappings };
        delete updated[ getMappingKey(action.payload) ];
        return { ...state, mappings: updated };

    case "SET_LOADING":
        return { ...state, isLoading: action.payload };

    case "SET_ERROR":
        return { ...state, error: action.payload };

    default:
        return state;
    }
}

type CurriculumMappingContextType = {
    state: MappingState;
    refreshMappings: () => Promise<void>;
    createMapping: (
        moduleId: GanttModuleId,
        eventId: GanttEventId | null,
        dayId: GanttDayId,
    ) => Promise<GanttCurriculumModuleDayMapping>;
    moveModule: (
        moduleId: GanttModuleId,
        eventId: GanttEventId | null,
        from: { d: GanttDayId; },
        to: { d: GanttDayId; },
    ) => Promise<void>;
    removeModule: (moduleId: GanttModuleId, eventId: GanttEventId | null, dayId: GanttDayId) => Promise<void>;
};

/**
 * Provider Context
 */
const CurriculumMappingContext = createContext<
    CurriculumMappingContextType | undefined
>(undefined);

export function CurriculumMappingProvider({
    children,
    curriculumId,
}: {
    children: React.ReactNode;
    curriculumId: GanttCurriculumId;
})
{
    const { enqueueSnackbar } = useSnackbar();
    const [ state, dispatch ] = useReducer(mappingReducer, {
        mappings: {},
        isLoading: false,
        error: null,
    });

    const refreshMappings = useCallback(async () =>
    {
        dispatch({ type: "SET_LOADING", payload: true });
        try
        {
            const data = await ganttApi.mappings.apiGet(curriculumId);
            dispatch({ type: "SET_MAPPINGS", payload: data });
        } catch (e)
        {
            dispatch({ type: "SET_ERROR", payload: JSON.stringify(e) });
            throw e;
        }
    }, [ dispatch, curriculumId ]);

    /**
   * createMapping: Handles assigning a module to a day for the first time.
   */
    const createMapping = useCallback(
        async (moduleId: GanttModuleId, eventId: GanttEventId | null, dayId: GanttDayId) =>
        {
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

            try
            {
                const result = await ganttApi.mappings.apiCreate(curriculumId, {
                    moduleId,
                    eventId,
                    dayId,
                    sortOrder: tempSortOrder,
                });
                // Update with the actual data from the server (e.g., if IDs or timestamps were generated)
                dispatch({ type: "UPSERT_MAPPING", payload: result });

                return result;
            } catch (e)
            {
                // Rollback on failure
                dispatch({ type: "DELETE_MAPPING", payload: { dayId, moduleId, eventId } });
                dispatch({ type: "SET_ERROR", payload: JSON.stringify(e) });
                throw e;
            }
        },
        [ dispatch, curriculumId ],
    );

    const moveModule = useCallback(
        async (
            moduleId: GanttModuleId,
            eventId: GanttEventId | null,
            from: { d: GanttDayId; },
            to: { d: GanttDayId; },
        ) =>
        {
            // Optimistic UI Update
            const oldKey = getMappingKey({ dayId: from.d, moduleId, eventId });
            const originalMapping = state.mappings[ oldKey ];

            if (!originalMapping) return;

            const updatedMapping = { ...originalMapping, dayId: to.d };

            dispatch({
                type: "DELETE_MAPPING",
                payload: { dayId: from.d, moduleId, eventId },
            });
            dispatch({ type: "UPSERT_MAPPING", payload: updatedMapping });

            try
            {
                await ganttApi.mappings.apiUpdate(
                    curriculumId,
                    moduleId,
                    eventId,
                    { dayId: from.d },
                    { dayId: to.d },
                );
            } catch (e)
            {
                // Rollback on failure
                dispatch({
                    type: "DELETE_MAPPING",
                    payload: { dayId: to.d, moduleId, eventId },
                });
                dispatch({ type: "UPSERT_MAPPING", payload: originalMapping });
                dispatch({ type: "SET_ERROR", payload: JSON.stringify(e) });
                throw e;
            }
        },
        [ state.mappings, curriculumId, dispatch ],
    );

    const removeModule = useCallback(
        async (moduleId: GanttModuleId, eventId: GanttEventId | null, dayId: GanttDayId) =>
        {
            dispatch({ type: "DELETE_MAPPING", payload: { dayId, moduleId, eventId } });
            try
            {
                await ganttApi.mappings.apiDelete(curriculumId, moduleId, eventId, dayId);
            } catch
            {
                await refreshMappings(); // Re-sync on failure
            }
        },
        [ refreshMappings, dispatch, curriculumId ],
    );

    useEffect(() =>
    {
        refreshMappings().catch((error) =>
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "טעינת מיפויי מערכים נכשלה!",
                error,
            ),
        );
    }, [ enqueueSnackbar, refreshMappings ]); // Initial load

    const value = useMemo(
        () => ({ state, refreshMappings, moveModule, removeModule, createMapping }),
        [ state, refreshMappings, moveModule, removeModule, createMapping ],
    );

    return (
        <CurriculumMappingContext.Provider value={ value }>
            { children }
        </CurriculumMappingContext.Provider>
    );
}

/**
 * Hook for specialized access
 */
export function useCurriculumMappings()
{
    const context = useContext(CurriculumMappingContext);
    if (!context)
        throw new Error(
            "useCurriculumMappings must be used within a CurriculumMappingProvider",
        );
    return context;
}
