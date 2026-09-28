type OrchestrationState = {
    syllabuses: Record<string, { modules: Array<string> } | undefined>;
    modules: Record<string, { events: Array<string>; defaultOrchestratorId: null | number } | undefined>;
    events: Record<string, { orchestratorId: null | number } | undefined>;
};

/** True when `userId` orchestrates any module (by default) or event of the syllabus. */
export function isOrchestratedBy(
    syllabusId: string,
    userId: number,
    state: OrchestrationState,
): boolean
{
    return (state.syllabuses[ syllabusId ]?.modules ?? []).some((moduleId) =>
    {
        const ganttModule = state.modules[ moduleId ];
        if (!ganttModule) return false;
        if (ganttModule.defaultOrchestratorId === userId) return true;
        return ganttModule.events.some((eventId) => state.events[ eventId ]?.orchestratorId === userId);
    });
}

/**
 * Stable partition: syllabuses the user orchestrates first, each group keeping
 * its existing order (#748). Returns the input array untouched when nothing moves.
 */
export function orchestratedFirst<TId extends string>(
    syllabusIds: Array<TId>,
    userId: null | number | undefined,
    state: OrchestrationState,
): Array<TId>
{
    if (userId == null) return syllabusIds;
    const mine: Array<TId> = [];
    const rest: Array<TId> = [];
    for (const id of syllabusIds) (isOrchestratedBy(id, userId, state) ? mine : rest).push(id);
    return mine.length === 0 || rest.length === 0 ? syllabusIds : [ ...mine, ...rest ];
}
