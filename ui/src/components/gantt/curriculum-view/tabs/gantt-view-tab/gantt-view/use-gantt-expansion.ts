import { useCallback, useState } from "react";

// Copy of `prev` with `id` flipped, or forced in/out by `include`. Returns
// `prev` itself when nothing changes, so React skips the re-render.
const toggled = (prev: Set<string>, id: string, include = !prev.has(id)) =>
{
    if (prev.has(id) === include) return prev;
    const next = new Set(prev);
    if (include) next.add(id);
    else next.delete(id);
    return next;
};

const without = (prev: Set<string>, id: string) => toggled(prev, id, false);

// Syllabus collapse/module expand state for the Gantt row tree, plus the
// "collapse/expand all" toolbar actions (#225). While searching, every row
// starts open so matches show (#323), but stays toggleable: toggles go to a
// search-only collapsed set, dropped when the search clears.
export const useGanttExpansion = (
    syllabusIds: Array<string>,
    searchActive: boolean,
) =>
{
    const [ collapsedSyllabusIds, setCollapsedSyllabusIds ] = useState<
        Set<string>
    >(() => new Set());
    const [ expandedModuleIds, setExpandedModuleIds ] = useState<Set<string>>(
        () => new Set(),
    );
    const [ searchCollapsedIds, setSearchCollapsedIds ] = useState<
        Set<string>
    >(() => new Set());

    const [ wasSearchActive, setWasSearchActive ] = useState(searchActive);
    if (wasSearchActive !== searchActive)
    {
        setWasSearchActive(searchActive);
        setSearchCollapsedIds(new Set());
    }

    const isSyllabusExpanded = useCallback(
        (syllabusId: string) =>
            searchActive
                ? !searchCollapsedIds.has(syllabusId)
                : !collapsedSyllabusIds.has(syllabusId),
        [ searchActive, searchCollapsedIds, collapsedSyllabusIds ],
    );

    const toggleSyllabus = useCallback((syllabusId: string) =>
    {
        if (searchActive)
            setSearchCollapsedIds((prev) => toggled(prev, syllabusId));
        else
            setCollapsedSyllabusIds((prev) => toggled(prev, syllabusId));
    }, [ searchActive ]);

    const collapseAllSyllabuses = useCallback(() =>
    {
        if (searchActive) setSearchCollapsedIds(new Set(syllabusIds));
        else setCollapsedSyllabusIds(new Set(syllabusIds));
    }, [ searchActive, syllabusIds ]);

    const expandAllSyllabuses = useCallback(() =>
    {
        if (searchActive) setSearchCollapsedIds(new Set());
        else setCollapsedSyllabusIds(new Set());
    }, [ searchActive ]);

    const allCollapsed =
        syllabusIds.length > 0 &&
        syllabusIds.every((id) => !isSyllabusExpanded(id));

    const isModuleExpanded = useCallback(
        (moduleId: string) =>
            searchActive
                ? !searchCollapsedIds.has(moduleId)
                : expandedModuleIds.has(moduleId),
        [ searchActive, searchCollapsedIds, expandedModuleIds ],
    );

    const toggleModule = useCallback((moduleId: string) =>
    {
        if (searchActive)
            setSearchCollapsedIds((prev) => toggled(prev, moduleId));
        else
            setExpandedModuleIds((prev) => toggled(prev, moduleId));
    }, [ searchActive ]);

    return {
        allCollapsed,
        collapseAllSyllabuses,
        expandAllSyllabuses,
        expandModuleFor: (moduleId: string) =>
        {
            setSearchCollapsedIds((prev) => without(prev, moduleId));
            setExpandedModuleIds((prev) => toggled(prev, moduleId, true));
        },
        exposeSyllabusFor: (syllabusId: string) =>
        {
            setSearchCollapsedIds((prev) => without(prev, syllabusId));
            setCollapsedSyllabusIds((prev) => without(prev, syllabusId));
        },
        isModuleExpanded,
        isSyllabusExpanded,
        toggleModule,
        toggleSyllabus,
    };
};
