/**
 * Name: provider.tsx
 * Purpose: Context provider for managing and syncing Gantt constraints with optimistic UI updates.
 * Created: 2026-04-19
 * Author: Michael K. Steinberg
 */

"use client";

import { useSnackbar } from "notistack";
import
    {
        ReactNode,
        useCallback,
        useEffect,
        useMemo,
        useReducer,
    } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { ganttApi } from "@/api-client/gantt";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { GanttConstraint } from "@/api-shared/types/gantt/models/constraint";
import { CreateConstraintPayload, GanttConstraintContext } from "@/components/gantt/state/constraints/context";
import { ganttConstraintReducer } from "@/components/gantt/state/constraints/reducer";

export function GanttConstraintProvider({
    children,
    curriculumId,
}: {
    children: ReactNode;
    curriculumId: GanttCurriculumId;
})
{
    const { enqueueSnackbar } = useSnackbar();
    const [ state, dispatch ] = useReducer(ganttConstraintReducer, {
        constraints: {},
        isLoading: true,
    });

    const refreshConstraints = useCallback(async () =>
    {
        dispatch({ type: "SET_LOADING", payload: true });
        try
        {
            const data = await ganttApi.constraints.apiGet(curriculumId);
            dispatch({ type: "SET_CONSTRAINTS", payload: data });
        } catch (error)
        {
            enqueueApiErrorSnackbar(enqueueSnackbar, "טעינת אילוצים נכשלה!", error);
            dispatch({ type: "SET_LOADING", payload: false });
        }
    }, [ dispatch, curriculumId, enqueueSnackbar ]);

    const createConstraint = useCallback(
        async (payload: CreateConstraintPayload) =>
        {
            // Generate a temporary ID for the optimistic update
            const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

            const optimisticConstraint: GanttConstraint = {
                ...payload,
                id: tempId,
            } as GanttConstraint;

            // Optimistic UI Update
            dispatch({ type: "UPSERT_CONSTRAINT", payload: optimisticConstraint });

            try
            {
                const result = await ganttApi.constraints.apiCreate(curriculumId, payload);

                // Remove the temporary constraint and inject the real database record
                dispatch({ type: "DELETE_CONSTRAINT", payload: { id: tempId } });
                dispatch({ type: "UPSERT_CONSTRAINT", payload: result });

                return result;
            } catch (e)
            {
                // Rollback on failure
                dispatch({ type: "DELETE_CONSTRAINT", payload: { id: tempId } });
                enqueueApiErrorSnackbar(enqueueSnackbar, 'יצירת אילוץ נכשלה!', e);
                return undefined;
            }
        },
        [ dispatch, enqueueSnackbar ],
    );

    const updateConstraint = useCallback(
        async (id: string, payload: Partial<CreateConstraintPayload>) =>
        {
            const originalConstraint = state.constraints[ id ];
            if (!originalConstraint) return;

            const updatedConstraint: GanttConstraint = {
                ...originalConstraint,
                ...payload,
            } as GanttConstraint;

            // Optimistic UI Update
            dispatch({ type: "UPSERT_CONSTRAINT", payload: updatedConstraint });

            try
            {
                await ganttApi.constraints.apiUpdate(curriculumId, id, payload);
            } catch (e)
            {
                // Rollback to original state on failure
                dispatch({ type: "UPSERT_CONSTRAINT", payload: originalConstraint });
                enqueueApiErrorSnackbar(enqueueSnackbar, 'עדכון אילוץ נכשל!', e);
            }
        },
        [ state.constraints, dispatch, enqueueSnackbar ],
    );

    const removeConstraint = useCallback(
        async (id: string) =>
        {
            const originalConstraint = state.constraints[ id ];
            if (!originalConstraint) return;

            // Optimistic UI Update
            dispatch({ type: "DELETE_CONSTRAINT", payload: { id } });

            try
            {
                await ganttApi.constraints.apiDelete(curriculumId, id);
            } catch (e)
            {
                // Rollback by re-inserting the cached item to avoid a full network refresh
                dispatch({ type: "UPSERT_CONSTRAINT", payload: originalConstraint });
                enqueueApiErrorSnackbar(enqueueSnackbar, 'מחיקת אילוץ נכשלה!', e);
            }
        },
        [ state.constraints, dispatch, enqueueSnackbar ],
    );

    useEffect(() =>
    {
        refreshConstraints();
    }, [ refreshConstraints ]);

    const value = useMemo(
        () => ({
            state,
            refreshConstraints,
            createConstraint,
            updateConstraint,
            removeConstraint,
        }),
        [ state, refreshConstraints, createConstraint, updateConstraint, removeConstraint ],
    );

    return (
        <GanttConstraintContext.Provider value={ value }>
            { children }
        </GanttConstraintContext.Provider>
    );
}