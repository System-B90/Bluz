import { ReactNode, useCallback, useEffect, useMemo, useReducer } from "react";

import { ganttApi } from "@/api-client/gantt";
import { ApiCurriculumExecutionResponse } from "@/api-shared/types/gantt/execution";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import {
    GanttExecutionContext,
    GanttExecutionState,
} from "@/components/gantt/state/execution/context";

type ExecutionAction =
    | { type: "SET_EXECUTION"; payload: ApiCurriculumExecutionResponse }
    | { type: "SET_FAILED" }
    | { type: "SET_LOADING" };

function executionReducer(
    state: GanttExecutionState,
    action: ExecutionAction,
): GanttExecutionState {
    switch (action.type) {
    case "SET_LOADING":
        return { ...state, isLoading: true };
    case "SET_EXECUTION":
        return {
            events: action.payload.events,
            isLoading: false,
            hasLoaded: true,
        };
    case "SET_FAILED":
        return { ...state, isLoading: false, hasLoaded: true };
    default:
        return state;
    }
}

/**
 * Read-only תכנון מול ביצוע state (#121): loads the plan-vs-actual comparison
 * for the curriculum once and exposes a manual refresh (the event dialog
 * refreshes on open so the comparison is current). Load failures degrade to an
 * empty comparison — the gantt renders exactly as if the curriculum was not
 * cut — rather than surfacing an error for a purely informational overlay.
 */
export function GanttExecutionProvider({
    children,
    curriculumId,
}: {
    children: ReactNode;
    curriculumId: GanttCurriculumId;
}) {
    const [state, dispatch] = useReducer(executionReducer, {
        events: {},
        isLoading: false,
        hasLoaded: false,
    });

    const refreshExecution = useCallback(async () => {
        dispatch({ type: "SET_LOADING" });
        try {
            const data = await ganttApi.execution.get(curriculumId);
            dispatch({ type: "SET_EXECUTION", payload: data });
        } catch {
            dispatch({ type: "SET_FAILED" });
        }
    }, [curriculumId]);

    useEffect(() => {
        void refreshExecution();
    }, [refreshExecution]);

    const recreateOccurrence = useCallback(
        async (ganttEventId: string, occurrenceDate: string) => {
            dispatch({ type: "SET_LOADING" });
            try {
                await ganttApi.execution.recreateOccurrence(
                    curriculumId,
                    ganttEventId,
                    occurrenceDate,
                );
            } catch (error) {
                dispatch({ type: "SET_FAILED" });
                throw error;
            }
            await refreshExecution();
        },
        [curriculumId, refreshExecution],
    );

    const value = useMemo(
        () => ({ state, refreshExecution, recreateOccurrence }),
        [state, refreshExecution, recreateOccurrence],
    );

    return (
        <GanttExecutionContext.Provider value={value}>
            {children}
        </GanttExecutionContext.Provider>
    );
}
