import { useSnackbar } from "notistack";
import { ReactNode, useCallback, useEffect, useMemo, useReducer } from "react";

import { ganttApi } from "@/api-client/gantt";
import {
    GanttCurriculumId,
    GanttDayId,
    GanttEventId,
    GanttModuleId,
} from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";
import { GanttRecurrenceExceptionContext } from "@/components/gantt/state/recurrence-exceptions/context";
import { ganttRecurrenceExceptionReducer } from "@/components/gantt/state/recurrence-exceptions/reducer";

export function GanttRecurrenceExceptionProvider({
    children,
    curriculumId,
}: {
    children: ReactNode;
    curriculumId: GanttCurriculumId;
}) {
    const { enqueueSnackbar } = useSnackbar();
    const { dispatch } = useCurriculumProviderActions();
    const { refreshMappings } = useGanttMappings();
    const [state, dispatchState] = useReducer(ganttRecurrenceExceptionReducer, {
        exceptions: {},
        isLoading: true,
    });

    const refreshExceptions = useCallback(
        async (signal?: AbortSignal) => {
            dispatchState({ type: "SET_LOADING", payload: true });
            const data = await ganttApi.recurrenceExceptions.apiGet(curriculumId);
            if (signal?.aborted) return;
            dispatchState({ type: "SET_EXCEPTIONS", payload: data });
        },
        [curriculumId],
    );

    const deleteOccurrence = useCallback(
        async ({
            eventId,
            dayId,
        }: {
            eventId: GanttEventId;
            dayId: GanttDayId;
        }) => {
            try {
                const exception =
                    await ganttApi.recurrenceExceptions.apiDeleteOccurrence(
                        eventId,
                        { curriculumId, dayId },
                    );
                dispatchState({ type: "UPSERT_EXCEPTION", payload: exception });
                return exception;
            } catch (e) {
                enqueueApiErrorSnackbar(enqueueSnackbar, "מחיקת המופע נכשלה!", e);
            }
        },
        [curriculumId, enqueueSnackbar],
    );

    // Undo of deleteOccurrence: the day is no longer excepted, so the event
    // echoes onto it again (#469).
    const restoreOccurrence = useCallback(
        async ({
            eventId,
            dayId,
        }: {
            eventId: GanttEventId;
            dayId: GanttDayId;
        }) => {
            try {
                await ganttApi.recurrenceExceptions.apiRestoreOccurrence(
                    eventId,
                    { curriculumId, dayId },
                );
                dispatchState({
                    type: "REMOVE_EXCEPTION",
                    payload: { eventId, dayId },
                });
                return true;
            } catch (e) {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "שחזור המופע נכשל!",
                    e,
                );
                return false;
            }
        },
        [curriculumId, enqueueSnackbar],
    );

    const materializeOccurrence = useCallback(
        async ({
            moduleId,
            eventId,
            dayId,
        }: {
            moduleId: GanttModuleId;
            eventId: GanttEventId;
            dayId: GanttDayId;
        }) => {
            try {
                const result =
                    await ganttApi.recurrenceExceptions.apiMaterializeOccurrence(
                        eventId,
                        { curriculumId, moduleId, dayId },
                    );

                dispatch({
                    type: "ADD_EVENT",
                    payload: { moduleId, event: result.event },
                });
                await Promise.all([refreshMappings(), refreshExceptions()]);

                return result;
            } catch (e) {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "הפיכת המופע לאירוע עצמאי נכשלה!",
                    e,
                );
            }
        },
        [curriculumId, dispatch, enqueueSnackbar, refreshMappings, refreshExceptions],
    );

    useEffect(() => {
        const controller = new AbortController();
        refreshExceptions(controller.signal).catch((error) => {
            if (controller.signal.aborted) return;
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "טעינת חריגות מופעים חוזרים נכשלה!",
                error,
            );
        });
        return () => controller.abort();
    }, [enqueueSnackbar, refreshExceptions]);

    const value = useMemo(
        () => ({
            state,
            refreshExceptions,
            deleteOccurrence,
            materializeOccurrence,
            restoreOccurrence,
        }),
        [
            state,
            refreshExceptions,
            deleteOccurrence,
            materializeOccurrence,
            restoreOccurrence,
        ],
    );

    return (
        <GanttRecurrenceExceptionContext.Provider value={value}>
            {children}
        </GanttRecurrenceExceptionContext.Provider>
    );
}
