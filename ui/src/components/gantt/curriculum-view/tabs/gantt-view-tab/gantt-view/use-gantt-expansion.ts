import { useCallback, useState } from "react";

// Syllabus collapse/module expand state for the Gantt row tree, plus the
// "collapse/expand all" toolbar actions (#225).
export const useGanttExpansion = (syllabusIds: Array<string>) =>
{
    const [ collapsedSyllabusIds, setCollapsedSyllabusIds ] = useState<
        Set<string>
    >(() => new Set());
    const [ expandedModuleIds, setExpandedModuleIds ] = useState<Set<string>>(
        () => new Set(),
    );

    const isSyllabusExpanded = useCallback(
        (syllabusId: string) => !collapsedSyllabusIds.has(syllabusId),
        [ collapsedSyllabusIds ],
    );

    const toggleSyllabus = useCallback((syllabusId: string) =>
    {
        setCollapsedSyllabusIds((prev) =>
        {
            const next = new Set(prev);
            if (next.has(syllabusId)) next.delete(syllabusId);
            else next.add(syllabusId);
            return next;
        });
    }, []);

    const collapseAllSyllabuses = useCallback(() =>
    {
        setCollapsedSyllabusIds(new Set(syllabusIds));
    }, [ syllabusIds ]);

    const expandAllSyllabuses = useCallback(() =>
    {
        setCollapsedSyllabusIds(new Set());
    }, []);

    const allCollapsed =
        syllabusIds.length > 0 &&
        syllabusIds.every((id) => collapsedSyllabusIds.has(id));

    const isModuleExpanded = useCallback(
        (moduleId: string) => expandedModuleIds.has(moduleId),
        [ expandedModuleIds ],
    );

    const toggleModule = useCallback((moduleId: string) =>
    {
        setExpandedModuleIds((prev) =>
        {
            const next = new Set(prev);
            if (next.has(moduleId)) next.delete(moduleId);
            else next.add(moduleId);
            return next;
        });
    }, []);

    return {
        allCollapsed,
        collapseAllSyllabuses,
        expandAllSyllabuses,
        expandModuleFor: (moduleId: string) =>
        {
            setExpandedModuleIds((prev) =>
            {
                if (prev.has(moduleId)) return prev;
                const next = new Set(prev);
                next.add(moduleId);
                return next;
            });
        },
        exposeSyllabusFor: (syllabusId: string) =>
        {
            setCollapsedSyllabusIds((prev) =>
            {
                if (!prev.has(syllabusId)) return prev;
                const next = new Set(prev);
                next.delete(syllabusId);
                return next;
            });
        },
        isModuleExpanded,
        isSyllabusExpanded,
        toggleModule,
        toggleSyllabus,
    };
};
