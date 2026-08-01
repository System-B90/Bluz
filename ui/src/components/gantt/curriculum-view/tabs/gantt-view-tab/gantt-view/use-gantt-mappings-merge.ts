import { useMemo } from "react";

import { GanttCurriculumModuleDayMapping } from "@/api-shared/types/gantt/models";

// Splits the global (cross-curriculum) mapping table into the three shapes
// the Gantt view actually consumes, scoped to this curriculum.
export const useGanttMappingsMerge = (
    globalMappings: Record<string, GanttCurriculumModuleDayMapping>,
    curriculumId: string,
) =>
{
    const moduleMappings = useMemo(() =>
    {
        const merged: Record<string, Array<string>> = {};
        Object.values(globalMappings).forEach((mapping: GanttCurriculumModuleDayMapping) =>
        {
            if (mapping.curriculumId !== curriculumId) return;
            if (!mapping.eventId)
            {
                const arr = merged[ mapping.moduleId ] || [];
                if (!arr.includes(mapping.dayId))
                {
                    merged[ mapping.moduleId ] = [ ...arr, mapping.dayId ];
                }
            }
        });
        return merged;
    }, [ globalMappings, curriculumId ]);

    const eventMappings = useMemo(() =>
    {
        const merged: Record<string, string> = {};
        Object.values(globalMappings).forEach((mapping: GanttCurriculumModuleDayMapping) =>
        {
            if (mapping.curriculumId !== curriculumId) return;
            if (mapping.eventId)
            {
                merged[ mapping.eventId ] = mapping.dayId;
            }
        });
        return merged;
    }, [ globalMappings, curriculumId ]);

    const curriculumMappings = useMemo(() =>
    {
        const merged: Record<string, GanttCurriculumModuleDayMapping> = {};
        Object.entries(globalMappings).forEach(([ mappingId, mapping ]: [ string, GanttCurriculumModuleDayMapping ]) =>
        {
            if (mapping.curriculumId !== curriculumId) return;
            merged[ mappingId ] = mapping;
        });
        return merged;
    }, [ globalMappings, curriculumId ]);

    return { curriculumMappings, eventMappings, moduleMappings };
};
