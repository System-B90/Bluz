import { useCallback, useEffect, useMemo, useRef } from "react";

import { ganttApi } from "@/api-client/gantt";
import { CreateGanttModulePayload } from "@/api-shared/types/gantt/create-payloads";
import {
    GanttModule,
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { makeEntityActions } from "@/components/gantt/state/hooks/gantt-funcs/MakeEntityActions";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/provider";

export function useModuleActions() {
    const { dispatch } = useCurriculumProviderActions();

    // Ref-backed store read so optimistic updates can snapshot current values
    // without recreating the memoized actions each render (#327).
    const state = useCurriculumState();
    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);
    const getEntity = useCallback(
        (id: GanttModuleId): GanttModule | undefined =>
            stateRef.current.modules[id],
        [],
    );

    const actions = useMemo(
        () =>
            makeEntityActions<
                GanttModule,
                GanttSyllabusId,
                CreateGanttModulePayload
            >({
                api: ganttApi.module,
                dispatch,
                label: "module",
                containerLabel: "syllabus",
                getEntity,
                builders: {
                    add: (module, syllabusId) => ({
                        type: "ADD_MODULE",
                        payload: { module, syllabusId },
                    }),
                    update: (id, updates) => ({
                        type: "UPDATE_MODULE",
                        payload: { id, updates },
                    }),
                    remove: (syllabusId, moduleId) => ({
                        type: "REMOVE_MODULE",
                        payload: { syllabusId, moduleId },
                    }),
                    discard: (moduleId) => ({
                        type: "PURGE_ENTITY",
                        payload: { collection: "modules", id: moduleId },
                    }),
                    allocateTime: (moduleId, curriculumId, duration) => ({
                        type: "ALLOCATE_TIME_TO_MODULE",
                        payload: { moduleId, curriculumId, duration },
                    }),
                },
            }),
        [dispatch, getEntity],
    );

    const createModule = useCallback(
        (
            title: string,
            syllabusId: GanttSyllabusId,
            description: string = "",
            hiveIds: Array<number> = [],
        ) =>
            actions.create(
                { title, syllabusId, description, hiveIds },
                syllabusId,
                (tempId): GanttModule => ({
                    id: tempId,
                    title,
                    description,
                    events: [],
                    hiveIds,
                    constraints: [],
                }),
            ),
        [actions],
    );

    return {
        createModule,
        updateModule: actions.update,
        deleteModule: actions.remove,
        linkModuleToSyllabus: actions.link,
        unlinkModuleToSyllabus: actions.unlink,
        allocateTimeToModule: actions.allocateTime,
    } as const;
}
