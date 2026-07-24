import { useCallback, useEffect, useMemo, useRef } from "react";

import { ganttApi } from "@/api-client/gantt";
import { normalizeApiSyllabus } from "@/api-client/gantt/drizzle-normalize";
import { ApiSyllabus } from "@/api-shared/types/gantt/api-layer";
import { CreateGanttSyllabusPayload } from "@/api-shared/types/gantt/create-payloads";
import {
    GanttCurriculumId,
    GanttSyllabus,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { makeEntityActions } from "@/components/gantt/state/hooks/gantt-funcs/MakeEntityActions";
import { withGantErrorHandling } from "@/components/gantt/state/hooks/gantt-funcs/WithGantErrorHandling";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/provider";

export function useSyllabusActions() {
    const { dispatch } = useCurriculumProviderActions();

    // Ref-backed store read so optimistic updates can snapshot current values
    // without recreating the memoized actions each render (#327).
    const state = useCurriculumState();
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);
    const getEntity = useCallback(
        (id: GanttSyllabusId): GanttSyllabus | undefined =>
            stateRef.current.syllabuses[id],
        [],
    );

    const actions = useMemo(
        () =>
            makeEntityActions<
                GanttSyllabus,
                GanttCurriculumId,
                CreateGanttSyllabusPayload
            >({
                api: ganttApi.syllabus,
                dispatch,
                label: "syllabus",
                containerLabel: "curriculum",
                getEntity,
                builders: {
                    add: (syllabus, curriculumId) => ({
                        type: "ADD_SYLLABUS",
                        payload: { syllabus, curriculumId },
                    }),
                    update: (id, updates) => ({
                        type: "UPDATE_SYLLABUS",
                        payload: { id, updates },
                    }),
                    remove: (curriculumId, syllabusId) => ({
                        type: "REMOVE_SYLLABUS",
                        payload: { curriculumId, syllabusId },
                    }),
                },
            }),
        [dispatch, getEntity],
    );

    const createSyllabus = useCallback(
        (
            title: string,
            curriculumId: GanttCurriculumId,
            hiveIds: Array<number> = [],
        ) =>
            actions.create({ title, curriculumId, hiveIds }, curriculumId),
        [actions],
    );

    // Linking an existing syllabus returns a fully-populated `ApiSyllabus`
    // (modules + events nested). The generic `actions.link` only dispatches
    // ADD_SYLLABUS, which stores the bare record and drops the subtree — so
    // the card shows 0 modules until a refetch (#320). Normalize the response
    // and merge the whole subtree so the real module count shows immediately.
    const linkSyllabusToCurriculum = useCallback(
        (curriculumId: GanttCurriculumId, syllabusId: GanttSyllabusId) =>
            withGantErrorHandling(async () => {
                const linked = (await ganttApi.syllabus.apiLink(
                    syllabusId,
                    curriculumId,
                )) as unknown as ApiSyllabus;
                const subtree = normalizeApiSyllabus(linked, curriculumId);
                dispatch({
                    type: "MERGE_SYLLABUS",
                    payload: { curriculumId, ...subtree },
                });
                return linked;
            }, `Failed to link syllabus (ID: ${syllabusId}) to curriculum (ID: ${curriculumId}):`),
        [dispatch],
    );

    return {
        createSyllabus,
        updateSyllabus: actions.update,
        deleteSyllabus: actions.remove,
        linkSyllabusToCurriculum,
        unlinkSyllabusFromCurriculum: actions.unlink,
    } as const;
}
