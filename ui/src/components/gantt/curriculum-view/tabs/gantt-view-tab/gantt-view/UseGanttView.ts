import { DragEndEvent } from "@dnd-kit/core";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { GanttCurriculumModuleDayMapping } from "@/api-shared/types/gantt/models";
import
{
    ConstraintType,
    GanttConstraint,
    hasConflictingTemporalConstraints,
} from "@/api-shared/types/gantt/models/constraint";
import
{
    buildDayIndexMap,
    buildWeekIndexByDayId,
    computeEventDaySpans,
    getSpilloverMinutesByDay,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { ConstraintLink } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import { useGanttUndo } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-undo";
import { useGanttConstraints } from "@/components/gantt/state/constraints/hooks";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import { useCurriculumState } from "@/components/gantt/state/provider";
import { useGanttRecurrenceExceptions } from "@/components/gantt/state/recurrence-exceptions/hooks";

export const useGanttView = (curriculumId: string) =>
{
    const state = useCurriculumState();
    const {
        state: { mappings: globalMappings },
        createMapping,
        moveMapping,
        removeMapping,
    } = useGanttMappings();
    const { deleteOccurrence } = useGanttRecurrenceExceptions();
    const {
        state: { constraints },
    } = useGanttConstraints();
    const curriculum = state.curriculums[ curriculumId ];

    // Strongly type as HTMLDivElement to satisfy MUI TableContainer
    const containerRef = useRef<HTMLDivElement>(null);
    const pendingScrollRafs = useRef<Array<number>>([]);

    const [ showConstraints, setShowConstraints ] = useState(true);
    const [ weeklyView, setWeeklyView ] = useState(true);
    const [ relativeDaySizing, setRelativeDaySizing ] = useState(false);
    const [ showUnallocated, setShowUnallocated ] = useState(false);
    const [ zoomedWeekId, setZoomedWeekId ] = useState<null | string>(null);
    const [ collapsedSyllabusIds, setCollapsedSyllabusIds ] = useState<
        Set<string>
    >(() => new Set());
    const [ expandedModuleIds, setExpandedModuleIds ] = useState<Set<string>>(
        () => new Set(),
    );
    const [ containerWidth, setContainerWidth ] = useState(0);
    // DOM id of a row to scroll into view once its ancestors have expanded.
    const [ pendingScrollId, setPendingScrollId ] = useState<null | string>(null);

    const allTimelineWeeks = useMemo(() =>
    {
        if (!curriculum) return [];
        return curriculum.weeks
            .map((weekId) => state.weeks[ weekId ])
            .filter((w) => !!w);
    }, [ curriculum, state.weeks ]);

    // Zoom only applies in days view. When active, restrict the grid to the one
    // zoomed week so it can fill the available width (#90).
    const timelineWeeks = useMemo(() =>
    {
        if (!weeklyView && zoomedWeekId)
        {
            const zoomed = allTimelineWeeks.find((w) => w.id === zoomedWeekId);
            if (zoomed) return [ zoomed ];
        }
        return allTimelineWeeks;
    }, [ allTimelineWeeks, weeklyView, zoomedWeekId ]);

    const linearDays = useMemo(() =>
    {
        return timelineWeeks.flatMap((w) => w.days);
    }, [ timelineWeeks ]);

    // O(1) replacements for the linearDays.indexOf(...) / timelineWeeks.findIndex(...)
    // scans that row/cell components previously ran per-item, per-render (#159).
    const dayIndexMap = useMemo(
        () => buildDayIndexMap(linearDays),
        [ linearDays ],
    );

    const weekIndexByDayId = useMemo(
        () => buildWeekIndexByDayId(timelineWeeks),
        [ timelineWeeks ],
    );

    // When zoomed the grid holds a single week, but date labels are derived from a
    // week's absolute position, so expose that offset to the header (#90).
    const weekIndexOffset = useMemo(() =>
    {
        if (weeklyView || !zoomedWeekId) return 0;
        const idx = allTimelineWeeks.findIndex((w) => w.id === zoomedWeekId);
        return idx === -1 ? 0 : idx;
    }, [ weeklyView, zoomedWeekId, allTimelineWeeks ]);

    // Widen day columns to fill the container when a single week is zoomed (#90).
    const dayCellWidth = useMemo(() =>
    {
        const DEFAULT_WIDTH = 80;
        const LABEL_COL_WIDTH = 250;
        if (weeklyView || !zoomedWeekId) return DEFAULT_WIDTH;
        const dayCount = timelineWeeks[ 0 ]?.days.length ?? 0;
        const available = containerWidth - LABEL_COL_WIDTH;
        if (dayCount <= 0 || available <= 0) return DEFAULT_WIDTH;
        return Math.max(DEFAULT_WIDTH, Math.floor(available / dayCount));
    }, [ weeklyView, zoomedWeekId, timelineWeeks, containerWidth ]);

    // Zoom is a days-view-only affordance: drop it when returning to weekly view.
    const handleWeeklyViewChange = useCallback((checked: boolean) =>
    {
        setWeeklyView(checked);
        if (checked) setZoomedWeekId(null);
    }, []);

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

    // Track the scroll container width so a zoomed week can be sized to fill it (#90).
    useEffect(() =>
    {
        const node = containerRef.current;
        if (!node || typeof ResizeObserver === "undefined") return;
        setContainerWidth(node.clientWidth);
        const observer = new ResizeObserver((entries) =>
        {
            setContainerWidth(entries[ 0 ].contentRect.width);
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

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

    const scheduledMinutesByDay = useMemo(
        () => getSpilloverMinutesByDay(eventSpans),
        [ eventSpans ],
    );

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

    const handleMapModule = useCallback(
        async (moduleId: string, dayId: string) =>
        {
            await createMapping({ moduleId, eventId: null, dayId });
        },
        [ createMapping ],
    );

    const handleMapEvent = useCallback(
        async (moduleId: string, eventId: string, dayId: string) =>
        {
            await createMapping({ moduleId, eventId, dayId });
        },
        [ createMapping ],
    );

    const handleMoveModule = useCallback(
        async (moduleId: string, sourceDayId: string, targetDayId: string) =>
        {
            await moveMapping({
                moduleId,
                eventId: null,
                from: { d: sourceDayId },
                to: { d: targetDayId },
            });
        },
        [ moveMapping ],
    );

    const handleMoveEvent = useCallback(
        async (
            moduleId: string,
            eventId: string,
            sourceDayId: string,
            targetDayId: string,
        ) =>
        {
            await moveMapping({
                moduleId,
                eventId,
                from: { d: sourceDayId },
                to: { d: targetDayId },
            });
        },
        [ moveMapping ],
    );

    const handleShiftModule = useCallback(
        async (moduleId: string, deltaDays: number) =>
        {
            if (deltaDays === 0) return;

            const ganttModule = state.modules[ moduleId ];
            const promises: Array<Promise<void>> = [];

            const mDays = moduleMappings[ moduleId ] || [];
            mDays.forEach((dayId) =>
            {
                const currentIdx = linearDays.indexOf(dayId);
                const newIdx = currentIdx + deltaDays;
                const targetDayId = linearDays[ newIdx ];
                if (targetDayId)
                {
                    promises.push(
                        moveMapping({
                            moduleId,
                            eventId: null,
                            from: { d: dayId },
                            to: { d: targetDayId },
                        }),
                    );
                }
            });

            if (ganttModule && ganttModule.events)
            {
                ganttModule.events.forEach((eventId) =>
                {
                    const currentDayId = eventMappings[ eventId ];
                    if (currentDayId)
                    {
                        const currentIdx = linearDays.indexOf(currentDayId);
                        const newIdx = currentIdx + deltaDays;
                        const targetDayId = linearDays[ newIdx ];
                        if (targetDayId)
                        {
                            promises.push(
                                moveMapping({
                                    moduleId,
                                    eventId,
                                    from: { d: currentDayId },
                                    to: { d: targetDayId },
                                }),
                            );
                        }
                    }
                });
            }

            await Promise.all(promises);
        },
        [ linearDays, state.modules, moduleMappings, eventMappings, moveMapping ],
    );

    // Undo stack for drag actions in the timeline (#142). Each entry is the
    // inverse of one completed user action; Ctrl+Z pops and executes it.
    const { pushUndo } = useGanttUndo();

    const handleDragEnd = useCallback(
        async (event: DragEndEvent) =>
        {
            const { active, over } = event;
            if (!over) return;

            const payload = active.data.current;
            const target = over.data.current;

            if (!payload || !target) return;

            if (target.targetType === "remove")
            {
                if (
                    payload.type === "module-move" ||
                    payload.type === "module-shift"
                )
                {
                    const mDays = moduleMappings[ payload.moduleId ] || [];
                    const promises: Array<Promise<void>> = [];
                    // Snapshot for undo: everything this drop removes (#142).
                    const removed: Array<{
                        eventId: null | string;
                        dayId: string;
                    }> = [];

                    mDays.forEach((d) =>
                    {
                        removed.push({ eventId: null, dayId: d });
                        promises.push(
                            removeMapping({
                                moduleId: payload.moduleId,
                                eventId: null,
                                dayId: d,
                            }),
                        );
                    });

                    const ganttModule = state.modules[ payload.moduleId ];
                    if (ganttModule && ganttModule.events)
                    {
                        ganttModule.events.forEach((eId) =>
                        {
                            const d = eventMappings[ eId ];
                            if (d)
                            {
                                removed.push({ eventId: eId, dayId: d });
                                promises.push(
                                    removeMapping({
                                        moduleId: payload.moduleId,
                                        eventId: eId,
                                        dayId: d,
                                    }),
                                );
                            }
                        });
                    }
                    await Promise.all(promises);
                    if (removed.length > 0)
                    {
                        pushUndo(async () =>
                        {
                            await Promise.all(
                                removed.map((r) =>
                                    createMapping({
                                        moduleId: payload.moduleId,
                                        eventId: r.eventId,
                                        dayId: r.dayId,
                                    }),
                                ),
                            );
                        });
                    }
                } else if (payload.type === "event-move")
                {
                    await removeMapping({
                        moduleId: payload.moduleId,
                        eventId: payload.eventId,
                        dayId: payload.sourceDayId,
                    });
                    pushUndo(async () =>
                    {
                        await createMapping({
                            moduleId: payload.moduleId,
                            eventId: payload.eventId,
                            dayId: payload.sourceDayId,
                        });
                    });
                } else if (payload.type === "event-occurrence")
                {
                    await deleteOccurrence({
                        eventId: payload.eventId,
                        dayId: payload.dayId,
                    });
                }
                return;
            }

            if (
                payload.type === "module-map" &&
                target.targetType === "module"
            )
            {
                await handleMapModule(payload.moduleId, target.dayId);
                pushUndo(async () =>
                {
                    await removeMapping({
                        moduleId: payload.moduleId,
                        eventId: null,
                        dayId: target.dayId,
                    });
                });
            } else if (
                payload.type === "event-map" &&
                target.targetType === "event"
            )
            {
                await handleMapEvent(
                    payload.moduleId,
                    payload.eventId,
                    target.dayId,
                );
                pushUndo(async () =>
                {
                    await removeMapping({
                        moduleId: payload.moduleId,
                        eventId: payload.eventId,
                        dayId: target.dayId,
                    });
                });
            } else if (
                payload.type === "module-move" &&
                target.targetType === "module"
            )
            {
                if (payload.sourceDayId !== target.dayId)
                {
                    await handleMoveModule(
                        payload.moduleId,
                        payload.sourceDayId,
                        target.dayId,
                    );
                    pushUndo(async () =>
                    {
                        await handleMoveModule(
                            payload.moduleId,
                            target.dayId,
                            payload.sourceDayId,
                        );
                    });
                }
            } else if (
                payload.type === "module-shift" &&
                target.targetType === "module"
            )
            {
                const sourceIdx = linearDays.indexOf(payload.sourceDayId);
                const targetIdx = linearDays.indexOf(target.dayId);
                const deltaDays = targetIdx - sourceIdx;

                if (deltaDays !== 0)
                {
                    await handleShiftModule(payload.moduleId, deltaDays);
                    pushUndo(async () =>
                    {
                        await handleShiftModule(payload.moduleId, -deltaDays);
                    });
                }
            } else if (
                payload.type === "event-move" &&
                target.targetType === "event"
            )
            {
                if (payload.sourceDayId !== target.dayId)
                {
                    await handleMoveEvent(
                        payload.moduleId,
                        payload.eventId,
                        payload.sourceDayId,
                        target.dayId,
                    );
                    pushUndo(async () =>
                    {
                        await handleMoveEvent(
                            payload.moduleId,
                            payload.eventId,
                            target.dayId,
                            payload.sourceDayId,
                        );
                    });
                }
            }
        },
        [
            handleMapModule,
            handleMapEvent,
            handleMoveModule,
            handleMoveEvent,
            handleShiftModule,
            linearDays,
            moduleMappings,
            eventMappings,
            removeMapping,
            createMapping,
            pushUndo,
            deleteOccurrence,
            state.modules,
        ],
    );

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
            singleWeekDayZoom: !weeklyView && zoomedWeekId !== null,
            setZoomedWeekId,
            weekIndexOffset,
            isSyllabusExpanded,
            toggleSyllabus,
            isModuleExpanded,
            toggleModule,
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
            weekIndexOffset,
            isSyllabusExpanded,
            toggleSyllabus,
            isModuleExpanded,
            toggleModule,
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
    };
};
