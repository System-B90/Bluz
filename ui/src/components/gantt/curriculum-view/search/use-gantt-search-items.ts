import { useMemo } from "react";

import {
    GanttEventId,
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { useCurriculumState } from "@/components/gantt/state/provider";

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
};

/**
 * Flatten the current curriculum into a hierarchically-ordered list of
 * searchable items (syllabus, then each of its modules, then each module's
 * events). Only the loaded curriculum is represented, so the search is
 * naturally scoped to the current curriculum.
 */
export function useGanttSearchItems(): Array<GanttSearchItem> {
    const state = useCurriculumState();

    return useMemo(() => {
        const items: Array<GanttSearchItem> = [];

        for (const syllabus of Object.values(state.syllabuses)) {
            items.push({
                id: syllabus.id,
                type: "syllabus",
                title: syllabus.title,
                path: syllabus.title,
                syllabusId: syllabus.id,
            });

            for (const moduleId of syllabus.modules ?? []) {
                const ganttModule = state.modules[moduleId];
                if (!ganttModule) continue;

                items.push({
                    id: ganttModule.id,
                    type: "module",
                    title: ganttModule.title,
                    path: `${syllabus.title} / ${ganttModule.title}`,
                    syllabusId: syllabus.id,
                    moduleId: ganttModule.id,
                });

                for (const eventId of ganttModule.events ?? []) {
                    const event = state.events[eventId];
                    if (!event) continue;

                    items.push({
                        id: event.id,
                        type: "event",
                        title: event.title,
                        path: `${syllabus.title} / ${ganttModule.title} / ${event.title}`,
                        syllabusId: syllabus.id,
                        moduleId: ganttModule.id,
                        eventId: event.id,
                    });
                }
            }
        }

        return items;
    }, [state]);
}
