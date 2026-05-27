import { useMemo } from "react";

import { TargetOption } from "@/components/gantt/module-dialog/constraints/types";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function useTargetOptions()
{
    const state = useCurriculumState();

    return useMemo(() =>
    {
        const result: Record<string, Array<TargetOption>> = {};

        for (const syllabus of Object.values(state.syllabuses))
        {
            result[ syllabus.id ] = [];
        }

        for (const ganttModule of Object.values(state.modules))
        {
            const syllabus = state.syllabuses[ ganttModule.syllabusId ];
            const label = `${syllabus.title} / ${ganttModule.title}`;

            result[ ganttModule.syllabusId ].push({
                id: ganttModule.id,
                label,
                type: "module",
                syllabusId: ganttModule.syllabusId,
            });

            for (const eventId of ganttModule.events)
            {
                const event = state.events[ eventId ];
                if (!event) continue;

                result[ ganttModule.syllabusId ].push({
                    id: event.id,
                    label: `${label} / ${event.title}`,
                    type: "event",
                    syllabusId: ganttModule.syllabusId,
                });
            }
        }

        for (const group of Object.values(result))
        {
            group.sort((a, b) => a.label.localeCompare(b.label));
        }

        return result;
    }, [ state ]);
}
