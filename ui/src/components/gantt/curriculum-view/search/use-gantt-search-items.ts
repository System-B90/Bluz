import { useMemo } from "react";

import {
    GanttEventId,
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { useCurriculumState } from "@/components/gantt/state/context";
import { useSyllabusTitles } from "@/components/gantt/state/hooks/UseSyllabusTitles";

export type GanttSearchItemType = "event" | "module" | "syllabus";

export type GanttSearchItem = {
    /** Unique key for the item (the underlying entity id). */
    id: string;
    type: GanttSearchItemType;
    /** The item's own name — what the fuzzy search matches against. */
    title: string;
    /** Full hierarchical path, e.g. `סילבוס / מערך / מופע`. */
    path: string;
    syllabusId: GanttSyllabusId;
    moduleId?: GanttModuleId;
    eventId?: GanttEventId;
    /** Responsible instructor's display name, for events — also matched against. */
    orchestratorName?: string;
};

/**
 * Flatten the current curriculum into a hierarchically-ordered list of
 * searchable items (syllabus, then each of its modules, then each module's
 * events). Only the loaded curriculum is represented, so the search is
 * naturally scoped to the current curriculum.
 */
export function useGanttSearchItems(): Array<GanttSearchItem> {
    const state = useCurriculumState();
    const { getInstructor } = useHiveUsers();
    const syllabusTitles = useSyllabusTitles();

    return useMemo(() => {
        const items: Array<GanttSearchItem> = [];

        for (const syllabus of Object.values(state.syllabuses)) {
            const syllabusTitle = syllabusTitles[syllabus.id] ?? syllabus.title;
            items.push({
                id: syllabus.id,
                type: "syllabus",
                title: syllabusTitle,
                path: syllabusTitle,
                syllabusId: syllabus.id,
            });

            for (const moduleId of syllabus.modules ?? []) {
                const ganttModule = state.modules[moduleId];
                if (!ganttModule) continue;

                items.push({
                    id: ganttModule.id,
                    type: "module",
                    title: ganttModule.title,
                    path: `${syllabusTitle} / ${ganttModule.title}`,
                    syllabusId: syllabus.id,
                    moduleId: ganttModule.id,
                });

                for (const eventId of ganttModule.events ?? []) {
                    const event = state.events[eventId];
                    if (!event) continue;

                    const orchestrator =
                        event.orchestratorId != null
                            ? getInstructor(event.orchestratorId)
                            : undefined;

                    items.push({
                        id: event.id,
                        type: "event",
                        title: event.title,
                        path: `${syllabusTitle} / ${ganttModule.title} / ${event.title}`,
                        syllabusId: syllabus.id,
                        moduleId: ganttModule.id,
                        eventId: event.id,
                        orchestratorName: orchestrator?.display_name,
                    });
                }
            }
        }

        return items;
    }, [state, getInstructor, syllabusTitles]);
}
