import dayjs from "dayjs";
import { useCallback, useDeferredValue, useMemo } from "react";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { useOutsiders } from "@/components/base/OutsidersProvider";
import { buildInsightContext } from "@/components/gantt/curriculum-view/components/insights/build-context";
import { generateInsights } from "@/components/gantt/curriculum-view/components/insights/generators";
import { Insight } from "@/components/gantt/curriculum-view/components/insights/types";
import { useCurriculumState } from "@/components/gantt/state/context";
import { useGanttExecution } from "@/components/gantt/state/execution/hooks";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import { useGanttRecurrenceExceptions } from "@/components/gantt/state/recurrence-exceptions/hooks";

export function useInsights(curriculum: GanttCurriculumDocument | undefined): Array<Insight> {
    const state = useCurriculumState();
    const { state: mappingState } = useGanttMappings();
    const { state: exceptionState } = useGanttRecurrenceExceptions();
    const { users } = useHiveUsers();
    const { getOutsider } = useOutsiders();
    const { state: executionState } = useGanttExecution();

    const instructorName = useCallback(
        (id: number) => users[ id ]?.display_name ?? `משתמש ${id}`,
        [ users ],
    );
    const outsiderName = useCallback(
        (id: string) => getOutsider(id)?.name,
        [ getOutsider ],
    );

    // Insights are ambient: let edits render first and recompute after.
    const deferredState = useDeferredValue(state);
    const deferredMappings = useDeferredValue(mappingState.mappings);

    return useMemo(() => {
        if (!curriculum) return [];
        return generateInsights(buildInsightContext({
            curriculum,
            state: deferredState,
            mappings: deferredMappings,
            exceptions: exceptionState.exceptions,
            now: dayjs(),
            instructorName,
            outsiderName,
            execution: executionState.events,
        }));
    }, [ curriculum, deferredState, deferredMappings, exceptionState.exceptions, executionState.events, instructorName, outsiderName ]);
}
