import { useMemo } from "react";

import { GanttCurriculum, GanttEvent, GanttModule, GanttSyllabus } from "@/api-shared/types/gantt/models";

// Modules/events with no day mapping yet, grouped by syllabus, for the
// "unallocated" panel (#89).
export const useGanttUnallocated = ({
    curriculum,
    eventMappings,
    events,
    moduleMappings,
    modules,
    syllabuses,
}: {
    curriculum: GanttCurriculum | undefined;
    eventMappings: Record<string, string>;
    events: Record<string, GanttEvent>;
    moduleMappings: Record<string, Array<string>>;
    modules: Record<string, GanttModule>;
    syllabuses: Record<string, GanttSyllabus>;
}) =>
{
    const unallocatedBySyllabus = useMemo(() =>
    {
        if (!curriculum) return [];
        return curriculum.syllabuses
            .map((syllabusId) =>
            {
                const syllabus = syllabuses[ syllabusId ];
                if (!syllabus) return null;

                const syllabusModules = (syllabus.modules ?? [])
                    .map((moduleId) => modules[ moduleId ])
                    .filter((m): m is NonNullable<typeof m> => !!m);

                const unallocatedModules = syllabusModules.filter((m) =>
                {
                    if ((moduleMappings[ m.id ] ?? []).length > 0) return false;
                    const moduleEvents = m.events ?? [];
                    if (moduleEvents.length === 0) return true;
                    return !moduleEvents.every((eventId) => !!eventMappings[ eventId ]);
                });
                const unallocatedEvents = syllabusModules.flatMap((m) =>
                    (m.events ?? [])
                        .map((eventId) => events[ eventId ])
                        .filter(
                            (e): e is NonNullable<typeof e> =>
                                !!e && !eventMappings[ e.id ],
                        )
                        .map((e) => ({
                            id: e.id,
                            title: e.title,
                            moduleId: m.id,
                        })),
                );

                if (
                    unallocatedModules.length === 0 &&
                    unallocatedEvents.length === 0
                )
                {
                    return null;
                }
                return {
                    syllabusId,
                    syllabusTitle: syllabus.title,
                    modules: unallocatedModules,
                    events: unallocatedEvents,
                };
            })
            .filter((g): g is NonNullable<typeof g> => g !== null);
    }, [ curriculum, syllabuses, modules, events, moduleMappings, eventMappings ]);

    const unallocatedCount = useMemo(
        () =>
            unallocatedBySyllabus.reduce(
                (sum, g) => sum + g.modules.length + g.events.length,
                0,
            ),
        [ unallocatedBySyllabus ],
    );

    return { unallocatedBySyllabus, unallocatedCount };
};
