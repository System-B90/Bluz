import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getRecurrenceOccurrenceDayIds } from "@/api-shared/gantt/recurrence";
import {
    EventRecurrence,
    GanttCurriculumModuleDayMapping,
} from "@/api-shared/types/gantt/models";
import
{
    ConstraintType,
    GanttConstraint,
    hasConflictingTemporalConstraints,
} from "@/api-shared/types/gantt/models/constraint";
import { computeEventDaySpans, getSpilloverMinutesByDay } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { fuzzyScore } from "@/components/gantt/curriculum-view/search/fuzzy";
import { ConstraintLink } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import { useGanttDrag } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-drag";
import { useGanttZoom } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-zoom";
import { useGanttConstraints } from "@/components/gantt/state/constraints/hooks";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/provider";
import { useGanttRecurrenceExceptions } from "@/components/gantt/state/recurrence-exceptions/hooks";

export const useGanttView = (curriculumId: string) =>
{
    const state = useCurriculumState();
    const { registerRevealHandler } = useCurriculumProviderActions();
    const {
        state: { mappings: globalMappings },
        createMapping,
        moveMapping,
        removeMapping,
    } = useGanttMappings();
    const { deleteOccurrence, state: recurrenceExceptionState } = useGanttRecurrenceExceptions();
    const {
        state: { constraints },
    } = useGanttConstraints();
    const curriculum = state.curriculums[ curriculumId ];

    const {
        containerRef,
        weeklyView,
        handleWeeklyViewChange,
        zoomedWeekId,
        setZoomedWeekId,
        timelineWeeks,
        linearDays,
        dayIndexMap,
        weekIndexByDayId,
        weekIndexOffset,
        dayCellWidth,
        singleWeekDayZoom,
    } = useGanttZoom({ curriculum, weeksById: state.weeks });

    const pendingScrollRafs = useRef<Array<number>>([]);

    const [ showConstraints, setShowConstraints ] = useState(true);
    const [ relativeDaySizing, setRelativeDaySizing ] = useState(false);
    const [ showUnallocated, setShowUnallocated ] = useState(false);
    const [ collapsedSyllabusIds, setCollapsedSyllabusIds ] = useState<
        Set<string>
    >(() => new Set());
    const [ expandedModuleIds, setExpandedModuleIds ] = useState<Set<string>>(
        () => new Set(),
    );
    // First-column search: filters the syllabus → module → event row tree by
    // title. Empty string = no filter (#323).
    const [ searchQuery, setSearchQuery ] = useState("");
    // DOM id of a row to scroll into view once its ancestors have expanded.
    const [ pendingScrollId, setPendingScrollId ] = useState<null | string>(null);

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
        setCollapsedSyllabusIds(new Set(curriculum?.syllabuses ?? []));
    }, [ curriculum?.syllabuses ]);

    const expandAllSyllabuses = useCallback(() =>
    {
        setCollapsedSyllabusIds(new Set());
    }, []);

    const allCollapsed =
        (curriculum?.syllabuses.length ?? 0) > 0 &&
        (curriculum?.syllabuses ?? []).every((id) =>
            collapsedSyllabusIds.has(id),
        );

    // Resolve which rows survive the first-column search. A syllabus/module
    // title match reveals its whole subtree; an event match reveals just that
    // event plus its parent module + syllabus for context. null = not filtering
    // (everything visible). (#323)
    const searchActive = searchQuery.trim().length > 0;
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
            const syllabus = state.syllabuses[ syllabusId ];
            if (!syllabus) continue;

            const syllabusMatches = matches(syllabus.title);
            let anyChildVisible = false;

            for (const moduleId of syllabus.modules)
            {
                const ganttModule = state.modules[ moduleId ];
                if (!ganttModule) continue;

                const showWholeModule =
                    syllabusMatches || matches(ganttModule.title);
                let anyEventVisible = false;

                for (const eventId of ganttModule.events ?? [])
                {
                    const event = state.events[ eventId ];
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
    }, [
        searchActive,
        searchQuery,
        curriculum?.syllabuses,
        state.syllabuses,
        state.modules,
        state.events,
    ]);

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

    // Reveal an unallocated module/event: expand its ancestors, then scroll its
    // row into view once rendered.
    const revealItem = useCallback(
        (syllabusId: string, moduleId: string, eventId?: string) =>
        {
            setCollapsedSyllabusIds((prev) =>
            {
                if (!prev.has(syllabusId)) return prev;
                const next = new Set(prev);
                next.delete(syllabusId);
                return next;
            });
            if (eventId)
            {
                setExpandedModuleIds((prev) =>
                {
                    if (prev.has(moduleId)) return prev;
                    const next = new Set(prev);
                    next.add(moduleId);
                    return next;
                });
            }
            setPendingScrollId(
                eventId
                    ? `gantt-row-event-${eventId}`
                    : `gantt-row-module-${moduleId}`,
            );
        },
        [],
    );

    // Expose this view's reveal behavior so other flows (event create/
    // duplicate) can scroll-to + flash a new row without a direct ref (#325).
    useEffect(
        () => registerRevealHandler(revealItem),
        [ registerRevealHandler, revealItem ],
    );

    // After the target's ancestors expand, scroll to it and flash a highlight.
    useEffect(() =>
    {
        if (!pendingScrollId) return;
        const raf1 = requestAnimationFrame(() =>
        {
            const raf2 = requestAnimationFrame(() =>
            {
                const el = document.getElementById(pendingScrollId);
                if (el)
                {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    el.dataset.ganttFlash = "true";
                    window.setTimeout(() =>
                    {
                        delete el.dataset.ganttFlash;
                    }, 1500);
                }
                setPendingScrollId(null);
            });
            pendingScrollRafs.current.push(raf2);
        });
        pendingScrollRafs.current.push(raf1);
        return () =>
        {
            pendingScrollRafs.current.forEach((id) =>
                cancelAnimationFrame(id),
            );
            pendingScrollRafs.current = [];
        };
    }, [ pendingScrollId ]);

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

    // Multi-day spillover layout: which days each mapped event actually
    // occupies, and per-day scheduled minutes with the spill applied (#105).
    const eventSpans = useMemo(
        () =>
            computeEventDaySpans({
                mappings: curriculumMappings,
                state,
                linearDays,
            }),
        [ curriculumMappings, state, linearDays ],
    );

    const dayIndexOf = useCallback(
        (dayId: string) => state.days[ dayId ]?.dayIndex,
        [ state.days ],
    );

    // Recurring events echo onto following days/weeks without a mapping row
    // for each occurrence, so their time must be added to those days
    // separately from `eventSpans` (which only covers mapped rows).
    const recurrenceMinutesByDay = useMemo(() =>
    {
        const byDay: Record<string, number> = {};
        Object.entries(eventMappings).forEach(([ eventId, startDayId ]) =>
        {
            const event = state.events[ eventId ];
            if (!event || event.recurrence === EventRecurrence.None) return;

            const excludedDayIds = new Set<string>();
            Object.values(recurrenceExceptionState.exceptions).forEach((e) =>
            {
                if (e.eventId === eventId) excludedDayIds.add(e.dayId);
            });

            const occurrenceDayIds = getRecurrenceOccurrenceDayIds({
                recurrence: event.recurrence,
                startDayId,
                linearDays,
                dayIndexOf,
                excludedDayIds,
            });

            occurrenceDayIds.forEach((dayId) =>
            {
                byDay[ dayId ] = (byDay[ dayId ] ?? 0) + (event.minimumDuration ?? 0);
            });
        });
        return byDay;
    }, [ eventMappings, state.events, recurrenceExceptionState.exceptions, linearDays, dayIndexOf ]);

    const scheduledMinutesByDay = useMemo(() =>
    {
        const merged = getSpilloverMinutesByDay(eventSpans);
        Object.entries(recurrenceMinutesByDay).forEach(([ dayId, minutes ]) =>
        {
            merged[ dayId ] = (merged[ dayId ] ?? 0) + minutes;
        });
        return merged;
    }, [ eventSpans, recurrenceMinutesByDay ]);

    // Modules/events with no day mapping yet, grouped by syllabus, for the
    // "unallocated" panel (#89).
    const unallocatedBySyllabus = useMemo(() =>
    {
        if (!curriculum) return [];
        return curriculum.syllabuses
            .map((syllabusId) =>
            {
                const syllabus = state.syllabuses[ syllabusId ];
                if (!syllabus) return null;

                const modules = (syllabus.modules ?? [])
                    .map((moduleId) => state.modules[ moduleId ])
                    .filter((m): m is NonNullable<typeof m> => !!m);

                const unallocatedModules = modules.filter((m) =>
                {
                    if ((moduleMappings[ m.id ] ?? []).length > 0) return false;
                    const events = m.events ?? [];
                    if (events.length === 0) return true;
                    return !events.every((eventId) => !!eventMappings[ eventId ]);
                });
                const unallocatedEvents = modules.flatMap((m) =>
                    (m.events ?? [])
                        .map((eventId) => state.events[ eventId ])
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
    }, [ curriculum, state.syllabuses, state.modules, state.events, moduleMappings, eventMappings ]);

    const unallocatedCount = useMemo(
        () =>
            unallocatedBySyllabus.reduce(
                (sum, g) => sum + g.modules.length + g.events.length,
                0,
            ),
        [ unallocatedBySyllabus ],
    );

    const { violations, activeLinks } = useMemo(() =>
    {
        const v: Record<string, Array<string>> = {};
        const links: Array<ConstraintLink> = [];

        const getMappedDayIdx = (type: "event" | "module", id: string) =>
        {
            if (type === "event")
            {
                const dayId = eventMappings[ id ];
                return dayId ? linearDays.indexOf(dayId) : -1;
            } else
            {
                const dayIds = moduleMappings[ id ] || [];
                const indices = dayIds
                    .map((d) => linearDays.indexOf(d))
                    .filter((i) => i !== -1);
                return indices.length ? Math.min(...indices) : -1;
            }
        };

        const processConstraints = (
            entity: { constraints?: Array<GanttConstraint> },
            entityId: string,
            entityType: "event" | "module",
        ) =>
        {
            const cIds: Array<string> = (entity.constraints || []).map(
                (c) => c.id,
            );

            // Conflicting temporal constraints are flagged even before the
            // entity is mapped to a day (#104). Warning only — never blocks.
            if (
                hasConflictingTemporalConstraints(
                    cIds.map((cId) => constraints[ cId ]),
                )
            )
            {
                if (!v[ entityId ]) v[ entityId ] = [];
                v[ entityId ].push("אילוצים סותרים: לא נותר אף יום חוקי");
            }

            const myIdx = getMappedDayIdx(entityType, entityId);
            if (myIdx === -1) return;

            const myDay = state.days[ linearDays[ myIdx ] ];
            if (!myDay) return;

            cIds.forEach((cId) =>
            {
                const c = constraints[ cId ];
                if (!c) return;

                if (c.type === ConstraintType.Temporal)
                {
                    if (
                        c.allowedDays &&
                        !c.allowedDays.includes(myDay.dayIndex)
                    )
                    {
                        if (!v[ entityId ]) v[ entityId ] = [];
                        v[ entityId ].push("מפר ימי עבודה מותרים");
                    }
                    if (
                        c.forbiddenDays &&
                        c.forbiddenDays.includes(myDay.dayIndex)
                    )
                    {
                        if (!v[ entityId ]) v[ entityId ] = [];
                        v[ entityId ].push("מפר ימי עבודה אסורים");
                    }
                } else if (c.type === ConstraintType.Relational)
                {
                    const targetIdx = getMappedDayIdx(c.targetType, c.targetId);
                    if (targetIdx === -1) return;

                    let isViolated = false;
                    const delta = myIdx - targetIdx;

                    if (c.relation === "after")
                    {
                        if (delta <= 0) isViolated = true;
                        if (
                            c.minDelayDays !== undefined &&
                            delta < c.minDelayDays
                        )
                            isViolated = true;
                        if (
                            c.maxDelayDays !== undefined &&
                            delta > c.maxDelayDays
                        )
                            isViolated = true;
                    } else if (c.relation === "before")
                    {
                        if (delta >= 0) isViolated = true;
                    }

                    if (isViolated)
                    {
                        if (!v[ entityId ]) v[ entityId ] = [];
                        v[ entityId ].push(
                            `מפר אילוץ יחסי עם ${c.targetType === "event" ? "מפגש" : "מערך"}`,
                        );
                    }

                    links.push({
                        id: `${entityId}-${c.targetId}`,
                        sourceId: `block-${entityType}-${entityId}`,
                        targetId: `block-${c.targetType}-${c.targetId}`,
                        isViolated,
                    });
                }
            });
        };

        Object.values(state.modules).forEach((m) =>
            processConstraints(m, m.id, "module"),
        );
        Object.values(state.events).forEach((e) =>
            processConstraints(e, e.id, "event"),
        );

        return { violations: v, activeLinks: links };
    }, [
        state.modules,
        state.events,
        constraints,
        moduleMappings,
        eventMappings,
        linearDays,
        state.days,
    ]);

    const {
        handleDragEnd,
        handleMapModule,
        handleMapEvent,
        handleMoveModule,
        handleMoveEvent,
        handleShiftModule,
    } = useGanttDrag({
        linearDays,
        modulesById: state.modules,
        moduleMappings,
        eventMappings,
        createMapping,
        moveMapping,
        removeMapping,
        deleteOccurrence,
    });

    // Memoized so context consumers (every day cell) don't re-render on unrelated
    // parent renders (#88).
    const contextValue = useMemo(
        () => ({
            weeklyView,
            showConstraints,
            relativeDaySizing,
            startDate: curriculum?.startDate ?? null,
            timelineWeeks,
            linearDays,
            dayIndexMap,
            weekIndexByDayId,
            moduleMappings,
            eventMappings,
            curriculumMappings,
            eventSpans,
            scheduledMinutesByDay,
            violations,
            dayCellWidth,
            zoomedWeekId,
            singleWeekDayZoom,
            setZoomedWeekId,
            weekIndexOffset,
            isSyllabusExpanded,
            toggleSyllabus,
            isModuleExpanded,
            toggleModule,
            searchActive,
            isSyllabusVisible,
            isModuleVisible,
            isEventVisible,
            onMapModule: handleMapModule,
            onMapEvent: handleMapEvent,
            onMoveModule: handleMoveModule,
            onMoveEvent: handleMoveEvent,
            onShiftModule: handleShiftModule,
        }),
        [
            weeklyView,
            showConstraints,
            relativeDaySizing,
            curriculum?.startDate,
            timelineWeeks,
            linearDays,
            dayIndexMap,
            weekIndexByDayId,
            moduleMappings,
            eventMappings,
            curriculumMappings,
            eventSpans,
            scheduledMinutesByDay,
            violations,
            dayCellWidth,
            zoomedWeekId,
            singleWeekDayZoom,
            weekIndexOffset,
            isSyllabusExpanded,
            toggleSyllabus,
            isModuleExpanded,
            toggleModule,
            searchActive,
            isSyllabusVisible,
            isModuleVisible,
            isEventVisible,
            handleMapModule,
            handleMapEvent,
            handleMoveModule,
            handleMoveEvent,
            handleShiftModule,
        ],
    );

    return {
        curriculum,
        containerRef,
        contextValue,
        handleDragEnd,
        showConstraints,
        setShowConstraints,
        weeklyView,
        handleWeeklyViewChange,
        relativeDaySizing,
        setRelativeDaySizing,
        showUnallocated,
        setShowUnallocated,
        zoomedWeekId,
        setZoomedWeekId,
        allCollapsed,
        collapseAllSyllabuses,
        expandAllSyllabuses,
        unallocatedBySyllabus,
        unallocatedCount,
        revealItem,
        activeLinks,
        searchQuery,
        setSearchQuery,
    };
};
