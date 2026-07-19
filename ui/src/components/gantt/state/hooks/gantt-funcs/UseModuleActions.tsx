import { useCallback, useMemo } from "react";

import { ganttApi } from "@/api-client/gantt";
import { CreateGanttModulePayload } from "@/api-shared/types/gantt/create-payloads";
import {
    GanttModule,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { makeEntityActions } from "@/components/gantt/state/hooks/gantt-funcs/MakeEntityActions";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

export function useModuleActions() {
    const { dispatch } = useCurriculumProviderActions();

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
                    allocateTime: (moduleId, curriculumId, duration) => ({
                        type: "ALLOCATE_TIME_TO_MODULE",
                        payload: { moduleId, curriculumId, duration },
                    }),
                },
            }),
        [dispatch],
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
