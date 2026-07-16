import { useCallback, useMemo } from "react";

import { ganttApi } from "@/api-client/gantt";
import { CreateGanttSyllabusPayload } from "@/api-shared/types/gantt/create-payloads";
import {
    GanttCurriculumId,
    GanttSyllabus,
} from "@/api-shared/types/gantt/models";
import { makeEntityActions } from "@/components/gantt/state/hooks/gantt-funcs/MakeEntityActions";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";

export function useSyllabusActions() {
    const { dispatch } = useCurriculumProviderActions();

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
        [dispatch],
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

    return {
        createSyllabus,
        updateSyllabus: actions.update,
        deleteSyllabus: actions.remove,
        linkSyllabusToCurriculum: actions.link,
        unlinkSyllabusFromCurriculum: actions.unlink,
    } as const;
}
