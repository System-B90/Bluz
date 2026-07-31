import { useCallback, useMemo, useState } from "react";

import { GanttCurriculum, GanttEvent, GanttModule, GanttSyllabus } from "@/api-shared/types/gantt/models";
import { fuzzyScore } from "@/components/gantt/curriculum-view/search/fuzzy";

// First-column search: filters the syllabus → module → event row tree by
// title. Empty string = no filter (#323).
export const useGanttSearch = ({
    curriculum,
    events,
    modules,
    syllabuses,
}: {
    curriculum: GanttCurriculum | undefined;
    events: Record<string, GanttEvent>;
    modules: Record<string, GanttModule>;
    syllabuses: Record<string, GanttSyllabus>;
}) =>
{
    const [ searchQuery, setSearchQuery ] = useState("");
    const searchActive = searchQuery.trim().length > 0;

    // Resolve which rows survive the first-column search. A syllabus/module
    // title match reveals its whole subtree; an event match reveals just that
    // event plus its parent module + syllabus for context. null = not filtering
    // (everything visible). (#323)
    const searchVisibility = useMemo(() =>
    {
        if (!searchActive) return null;

        const syllabusIds = new Set<string>();
        const moduleIds = new Set<string>();
        const eventIds = new Set<string>();
        // Reuse the app's fuzzy matcher so first-column filtering behaves like
        // the navigate-to search (quote-insensitive, subsequence-tolerant).
        const matches = (title?: string) =>
            fuzzyScore(searchQuery, title ?? "") > 0;

        for (const syllabusId of curriculum?.syllabuses ?? [])
        {
            const syllabus = syllabuses[ syllabusId ];
            if (!syllabus) continue;

            const syllabusMatches = matches(syllabus.title);
            let anyChildVisible = false;

            for (const moduleId of syllabus.modules)
            {
                const ganttModule = modules[ moduleId ];
                if (!ganttModule) continue;

                const showWholeModule =
                    syllabusMatches || matches(ganttModule.title);
                let anyEventVisible = false;

                for (const eventId of ganttModule.events ?? [])
                {
                    const event = events[ eventId ];
                    if (showWholeModule || (event && matches(event.title)))
                    {
                        eventIds.add(eventId);
                        anyEventVisible = true;
                    }
                }

                if (showWholeModule || anyEventVisible)
                {
                    moduleIds.add(moduleId);
                    anyChildVisible = true;
                }
            }

            if (syllabusMatches || anyChildVisible) syllabusIds.add(syllabusId);
        }

        return { syllabusIds, moduleIds, eventIds };
    }, [ searchActive, searchQuery, curriculum?.syllabuses, syllabuses, modules, events ]);

    const isSyllabusVisible = useCallback(
        (syllabusId: string) =>
            !searchVisibility || searchVisibility.syllabusIds.has(syllabusId),
        [ searchVisibility ],
    );
    const isModuleVisible = useCallback(
        (moduleId: string) =>
            !searchVisibility || searchVisibility.moduleIds.has(moduleId),
        [ searchVisibility ],
    );
    const isEventVisible = useCallback(
        (eventId: string) =>
            !searchVisibility || searchVisibility.eventIds.has(eventId),
        [ searchVisibility ],
    );

    return {
        isEventVisible,
        isModuleVisible,
        isSyllabusVisible,
        searchActive,
        searchQuery,
        setSearchQuery,
    };
};
