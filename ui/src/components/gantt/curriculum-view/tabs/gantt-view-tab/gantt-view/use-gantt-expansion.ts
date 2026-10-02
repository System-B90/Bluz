import { useCallback, useMemo, useState } from "react";

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

const NONE: Set<string> = new Set();

// Syllabus collapse/module expand state for the Gantt row tree, plus the
// "collapse/expand all" toolbar actions (#225). While searching, every row
// starts open so matches show (#323), but stays toggleable: toggles go to a
// search-only collapsed set, dropped when the search clears.
export const useGanttExpansion = (
    syllabusIds: Array<string>,
    searchActive: boolean,
    // Syllabuses open until the viewer touches anything; unset ⇒ all of them.
    defaultExpanded?: Array<string>,
) =>
{
    const defaultCollapsed = useMemo(
        () => (defaultExpanded
            ? new Set(syllabusIds.filter((id) => !defaultExpanded.includes(id)))
            : NONE),
        [ defaultExpanded, syllabusIds ],
    );
    // Null until the first manual change, so a default that arrives late (user, courses) still applies.
    const [ touchedCollapsed, setCollapsedSyllabusIds ] = useState<null | Set<string>>(null);
    const collapsedSyllabusIds = touchedCollapsed ?? defaultCollapsed;
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
            setCollapsedSyllabusIds((prev) => toggled(prev ?? defaultCollapsed, syllabusId));
    }, [ defaultCollapsed, searchActive ]);

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

    // Every row at once: syllabuses (and shuffle sections) per `syllabusKeys`, modules per `moduleKeys`.
    const setAllRows = useCallback((open: boolean, syllabusKeys: Array<string>, moduleKeys: Array<string>) =>
    {
        if (searchActive)
        {
            setSearchCollapsedIds(open ? new Set() : new Set([ ...syllabusKeys, ...moduleKeys ]));
            return;
        }
        setCollapsedSyllabusIds(open ? new Set() : new Set(syllabusKeys));
        setExpandedModuleIds(open ? new Set(moduleKeys) : new Set());
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
        setAllRows,
        expandModuleFor: (moduleId: string) =>
        {
            setSearchCollapsedIds((prev) => without(prev, moduleId));
            setExpandedModuleIds((prev) => toggled(prev, moduleId, true));
        },
        exposeSyllabusFor: (syllabusId: string) =>
        {
            setSearchCollapsedIds((prev) => without(prev, syllabusId));
            setCollapsedSyllabusIds((prev) => without(prev ?? defaultCollapsed, syllabusId));
        },
        isModuleExpanded,
        isSyllabusExpanded,
        toggleModule,
        toggleSyllabus,
    };
};
