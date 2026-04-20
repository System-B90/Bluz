/**
 * Name: provider.tsx
 * Purpose: Context provider for managing and syncing Gantt constraints, scoped by curriculum or module.
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
import { GanttCurriculumId, GanttModuleId } from "@/api-shared/types/gantt/models";
import { ConstraintType, GanttConstraint } from "@/api-shared/types/gantt/models/constraint";
import { CreateConstraintPayload, GanttConstraintContext } from "@/components/gantt/state/constraints/context";
import { ganttConstraintReducer } from "@/components/gantt/state/constraints/reducer";

export type ProviderScope =
    | { type: "curriculum"; curriculumId: GanttCurriculumId; }
    | { type: "module"; curriculumId: GanttCurriculumId; syllabusId: string; moduleId: GanttModuleId; };

export function GanttConstraintProvider({
    children,
    context,
}: {
    children: ReactNode;
    context: ProviderScope;
})
{
    const { enqueueSnackbar } = useSnackbar();
    const [ state, dispatch ] = useReducer(ganttConstraintReducer, {
        constraints: {},
        isLoading: true,
    });

    const curriculumId = context.curriculumId;

    // Helper to determine if the current scope has mutation rights over a constraint
    const canModify = useCallback((constraint: CreateConstraintPayload | GanttConstraint) =>
    {
        if (context.type === "curriculum") return true;
        if (constraint.type === ConstraintType.Temporal) return true;

        // In module scope, we cannot modify constraints owned by a DIFFERENT module.
        if (constraint.ownerModuleId && constraint.ownerModuleId !== context.moduleId)
        {
            return false;
        }

        // If the constraint is owned by another module but targets us, it's read-only.
        if (!constraint.ownerModuleId && !constraint.ownerEventId)
        {
            return false;
        }

        return true;
    }, [ context ]);

    const refreshConstraints = useCallback(async () =>
    {
        dispatch({ type: "SET_LOADING", payload: true });
        try
        {
            const queryOptions = context.type === "module" ? { moduleId: context.moduleId, syllabusId: context.syllabusId } : {};
            const data = await ganttApi.constraints.apiGet(curriculumId, queryOptions);

            dispatch({ type: "SET_CONSTRAINTS", payload: data });
        } catch (error)
        {
            enqueueApiErrorSnackbar(enqueueSnackbar, "טעינת אילוצים נכשלה!", error);
            dispatch({ type: "SET_LOADING", payload: false });
        }
    }, [ dispatch, curriculumId, context, enqueueSnackbar ]);

    const createConstraint = useCallback(
        async (payload: CreateConstraintPayload) =>
        {
            if (!canModify(payload))
            {
                enqueueSnackbar("אין לך הרשאה ליצור אילוץ זה מהקשר הנוכחי.", { variant: "error" });
                return undefined;
            }

            const tempId = `temp-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

            const optimisticConstraint = {
                ...payload,
                id: tempId,
                createdAt: new Date(),
                updatedAt: new Date(),
            } as GanttConstraint;

            dispatch({ type: "UPSERT_CONSTRAINT", payload: optimisticConstraint });

            try
            {
                const result = await ganttApi.constraints.apiCreate(curriculumId, payload);

                dispatch({ type: "DELETE_CONSTRAINT", payload: { id: tempId } });
                dispatch({ type: "UPSERT_CONSTRAINT", payload: result });

                return result;
            } catch (e)
            {
                dispatch({ type: "DELETE_CONSTRAINT", payload: { id: tempId } });
                enqueueApiErrorSnackbar(enqueueSnackbar, 'יצירת אילוץ נכשלה!', e);
                return undefined;
            }
        },
        [ dispatch, curriculumId, canModify, enqueueSnackbar ],
    );

    const updateConstraint = useCallback(
        async (id: string, payload: Partial<CreateConstraintPayload>) =>
        {
            const originalConstraint = state.constraints[ id ];
            if (!originalConstraint) return;

            if (!canModify(originalConstraint))
            {
                enqueueSnackbar("אינך יכול לערוך אילוץ המוגדר על ידי מודול אחר.", { variant: "warning" });
                return;
            }

            const updatedConstraint = {
                ...originalConstraint,
                ...payload,
            } as GanttConstraint;

            dispatch({ type: "UPSERT_CONSTRAINT", payload: updatedConstraint });

            try
            {
                await ganttApi.constraints.apiUpdate(curriculumId, id, payload);
            } catch (e)
            {
                dispatch({ type: "UPSERT_CONSTRAINT", payload: originalConstraint });
                enqueueApiErrorSnackbar(enqueueSnackbar, 'עדכון אילוץ נכשל!', e);
            }
        },
        [ state.constraints, curriculumId, dispatch, canModify, enqueueSnackbar ],
    );

    const removeConstraint = useCallback(
        async (id: string) =>
        {
            const originalConstraint = state.constraints[ id ];
            if (!originalConstraint) return;

            if (!canModify(originalConstraint))
            {
                enqueueSnackbar("אינך יכול למחוק אילוץ המוגדר על ידי מודול אחר.", { variant: "error" });
                return;
            }

            dispatch({ type: "DELETE_CONSTRAINT", payload: { id } });

            try
            {
                await ganttApi.constraints.apiDelete(curriculumId, id);
            } catch (e)
            {
                dispatch({ type: "UPSERT_CONSTRAINT", payload: originalConstraint });
                enqueueApiErrorSnackbar(enqueueSnackbar, 'מחיקת אילוץ נכשלה!', e);
            }
        },
        [ state.constraints, curriculumId, dispatch, canModify, enqueueSnackbar ],
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
