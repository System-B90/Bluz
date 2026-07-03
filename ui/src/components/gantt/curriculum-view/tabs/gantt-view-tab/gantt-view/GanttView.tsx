import {
    DndContext,
    DragEndEvent,
    MeasuringStrategy,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import CalendarViewDayIcon from "@mui/icons-material/CalendarViewDay";
import CalendarViewWeekIcon from "@mui/icons-material/CalendarViewWeek";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import RuleIcon from "@mui/icons-material/Rule";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { ConstraintType } from "@/api-shared/types/gantt/models/constraint";
import {
    computeEventDaySpans,
    getSpilloverMinutesByDay,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import { ConstraintLines } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/ConstraintLines";
import { GanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { GanttHeader } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttHeader";
import { GanttSyllabusGroup } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttSyllabusGroup";
import {
    ConstraintLink,
    GanttViewProps,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import { useGanttConstraints } from "@/components/gantt/state/constraints/hooks";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import { useCurriculumState } from "@/components/gantt/state/provider";

export const GanttView: React.FC<GanttViewProps> = ({ curriculumId }) => {
    const theme = useTheme();
    const state = useCurriculumState();
    const {
        state: { mappings: globalMappings },
        createMapping,
        moveMapping,
        removeMapping,
    } = useGanttMappings();
    const {
        state: { constraints },
    } = useGanttConstraints();
    const curriculum = state.curriculums[curriculumId];

    // Strongly type as HTMLDivElement to satisfy MUI TableContainer
    const containerRef = useRef<HTMLDivElement>(null);
    const pendingScrollRafs = useRef<Array<number>>([]);

    const [showConstraints, setShowConstraints] = useState(true);
    const [weeklyView, setWeeklyView] = useState(true);
    const [showUnallocated, setShowUnallocated] = useState(false);
    const [zoomedWeekId, setZoomedWeekId] = useState<null | string>(null);
    const [collapsedSyllabusIds, setCollapsedSyllabusIds] = useState<
        Set<string>
    >(() => new Set());
    const [expandedModuleIds, setExpandedModuleIds] = useState<Set<string>>(
        () => new Set(),
    );
    const [containerWidth, setContainerWidth] = useState(0);
    // DOM id of a row to scroll into view once its ancestors have expanded.
    const [pendingScrollId, setPendingScrollId] = useState<null | string>(null);

    // Require a small drag distance before activating, so a click never pays the
    // (day-view) droppable measurement cost and drags feel intentional (#88).
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    );

    const allTimelineWeeks = useMemo(() => {
        if (!curriculum) return [];
        return curriculum.weeks
            .map((weekId) => state.weeks[weekId])
            .filter((w) => !!w);
    }, [curriculum, state.weeks]);

    // Zoom only applies in days view. When active, restrict the grid to the one
    // zoomed week so it can fill the available width (#90).
    const timelineWeeks = useMemo(() => {
        if (!weeklyView && zoomedWeekId) {
            const zoomed = allTimelineWeeks.find((w) => w.id === zoomedWeekId);
            if (zoomed) return [zoomed];
        }
        return allTimelineWeeks;
    }, [allTimelineWeeks, weeklyView, zoomedWeekId]);

    const linearDays = useMemo(() => {
        return timelineWeeks.flatMap((w) => w.days);
    }, [timelineWeeks]);

    // When zoomed the grid holds a single week, but date labels are derived from a
    // week's absolute position, so expose that offset to the header (#90).
    const weekIndexOffset = useMemo(() => {
        if (weeklyView || !zoomedWeekId) return 0;
        const idx = allTimelineWeeks.findIndex((w) => w.id === zoomedWeekId);
        return idx === -1 ? 0 : idx;
    }, [weeklyView, zoomedWeekId, allTimelineWeeks]);

    // Widen day columns to fill the container when a single week is zoomed (#90).
    const dayCellWidth = useMemo(() => {
        const DEFAULT_WIDTH = 80;
        const LABEL_COL_WIDTH = 250;
        if (weeklyView || !zoomedWeekId) return DEFAULT_WIDTH;
        const dayCount = timelineWeeks[0]?.days.length ?? 0;
        const available = containerWidth - LABEL_COL_WIDTH;
        if (dayCount <= 0 || available <= 0) return DEFAULT_WIDTH;
        return Math.max(DEFAULT_WIDTH, Math.floor(available / dayCount));
    }, [weeklyView, zoomedWeekId, timelineWeeks, containerWidth]);

    // Zoom is a days-view-only affordance: drop it when returning to weekly view.
    const handleWeeklyViewChange = useCallback((checked: boolean) => {
        setWeeklyView(checked);
        if (checked) setZoomedWeekId(null);
    }, []);

    const isSyllabusExpanded = useCallback(
        (syllabusId: string) => !collapsedSyllabusIds.has(syllabusId),
        [collapsedSyllabusIds],
    );

    const toggleSyllabus = useCallback((syllabusId: string) => {
        setCollapsedSyllabusIds((prev) => {
            const next = new Set(prev);
            if (next.has(syllabusId)) next.delete(syllabusId);
            else next.add(syllabusId);
            return next;
        });
    }, []);

    const collapseAllSyllabuses = useCallback(() => {
        setCollapsedSyllabusIds(new Set(curriculum?.syllabuses ?? []));
    }, [curriculum?.syllabuses]);

    const expandAllSyllabuses = useCallback(() => {
        setCollapsedSyllabusIds(new Set());
    }, []);

    const allCollapsed =
        (curriculum?.syllabuses.length ?? 0) > 0 &&
        (curriculum?.syllabuses ?? []).every((id) =>
            collapsedSyllabusIds.has(id),
        );

    const isModuleExpanded = useCallback(
        (moduleId: string) => expandedModuleIds.has(moduleId),
        [expandedModuleIds],
    );

    const toggleModule = useCallback((moduleId: string) => {
        setExpandedModuleIds((prev) => {
            const next = new Set(prev);
            if (next.has(moduleId)) next.delete(moduleId);
            else next.add(moduleId);
            return next;
        });
    }, []);

    // Reveal an unallocated module/event: expand its ancestors, then scroll its
    // row into view once rendered.
    const revealItem = useCallback(
        (syllabusId: string, moduleId: string, eventId?: string) => {
            setCollapsedSyllabusIds((prev) => {
                if (!prev.has(syllabusId)) return prev;
                const next = new Set(prev);
                next.delete(syllabusId);
                return next;
            });
            if (eventId) {
                setExpandedModuleIds((prev) => {
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
    useEffect(() => {
        if (!pendingScrollId) return;
        const raf1 = requestAnimationFrame(() => {
            const raf2 = requestAnimationFrame(() => {
                const el = document.getElementById(pendingScrollId);
                if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    el.dataset.ganttFlash = "true";
                    window.setTimeout(() => {
                        delete el.dataset.ganttFlash;
                    }, 1500);
                }
                setPendingScrollId(null);
            });
            pendingScrollRafs.current.push(raf2);
        });
        pendingScrollRafs.current.push(raf1);
        return () => {
            pendingScrollRafs.current.forEach((id) =>
                cancelAnimationFrame(id),
            );
            pendingScrollRafs.current = [];
        };
    }, [pendingScrollId]);

    // Track the scroll container width so a zoomed week can be sized to fill it (#90).
    useEffect(() => {
        const node = containerRef.current;
        if (!node || typeof ResizeObserver === "undefined") return;
        setContainerWidth(node.clientWidth);
        const observer = new ResizeObserver((entries) => {
            setContainerWidth(entries[0].contentRect.width);
        });
        observer.observe(node);
        return () => observer.disconnect();
    }, []);

    const moduleMappings = useMemo(() => {
        const merged: Record<string, Array<string>> = {};
        Object.values(globalMappings).forEach((mapping: any) => {
            if (mapping.curriculumId !== curriculumId) return;
            if (!mapping.eventId) {
                const arr = merged[mapping.moduleId] || [];
                if (!arr.includes(mapping.dayId)) {
                    merged[mapping.moduleId] = [...arr, mapping.dayId];
                }
            }
        });
        return merged;
    }, [globalMappings, curriculumId]);

    const eventMappings = useMemo(() => {
        const merged: Record<string, string> = {};
        Object.values(globalMappings).forEach((mapping: any) => {
            if (mapping.curriculumId !== curriculumId) return;
            if (mapping.eventId) {
                merged[mapping.eventId] = mapping.dayId;
            }
        });
        return merged;
    }, [globalMappings, curriculumId]);

    const curriculumMappings = useMemo(() => {
        const merged: Record<string, any> = {};
        Object.entries(globalMappings).forEach(([mappingId, mapping]: [string, any]) => {
            if (mapping.curriculumId !== curriculumId) return;
            merged[mappingId] = mapping;
        });
        return merged;
    }, [globalMappings, curriculumId]);

    // Multi-day spillover layout: which days each mapped event actually
    // occupies, and per-day scheduled minutes with the spill applied (#105).
    const eventSpans = useMemo(
        () =>
            computeEventDaySpans({
                mappings: curriculumMappings,
                state,
                linearDays,
            }),
        [curriculumMappings, state, linearDays],
    );

    const scheduledMinutesByDay = useMemo(
        () => getSpilloverMinutesByDay(eventSpans),
        [eventSpans],
    );

    // Modules/events with no day mapping yet, grouped by syllabus, for the
    // "unallocated" panel (#89).
    const unallocatedBySyllabus = useMemo(() => {
        if (!curriculum) return [];
        return curriculum.syllabuses
            .map((syllabusId) => {
                const syllabus = state.syllabuses[syllabusId];
                if (!syllabus) return null;

                const modules = (syllabus.modules ?? [])
                    .map((moduleId) => state.modules[moduleId])
                    .filter((m): m is NonNullable<typeof m> => !!m);

                const unallocatedModules = modules.filter(
                    (m) => (moduleMappings[m.id] ?? []).length === 0,
                );
                const unallocatedEvents = modules.flatMap((m) =>
                    (m.events ?? [])
                        .map((eventId) => state.events[eventId])
                        .filter(
                            (e): e is NonNullable<typeof e> =>
                                !!e && !eventMappings[e.id],
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
                ) {
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
    }, [curriculum, state.syllabuses, state.modules, state.events, moduleMappings, eventMappings]);

    const unallocatedCount = useMemo(
        () =>
            unallocatedBySyllabus.reduce(
                (sum, g) => sum + g.modules.length + g.events.length,
                0,
            ),
        [unallocatedBySyllabus],
    );

    const { violations, activeLinks } = useMemo(() => {
        const v: Record<string, Array<string>> = {};
        const links: Array<ConstraintLink> = [];

        const getMappedDayIdx = (type: "event" | "module", id: string) => {
            if (type === "event") {
                const dayId = eventMappings[id];
                return dayId ? linearDays.indexOf(dayId) : -1;
            } else {
                const dayIds = moduleMappings[id] || [];
                const indices = dayIds
                    .map((d) => linearDays.indexOf(d))
                    .filter((i) => i !== -1);
                return indices.length ? Math.min(...indices) : -1;
            }
        };

        const processConstraints = (
            entity: any,
            entityId: string,
            entityType: "event" | "module",
        ) => {
            const cIds: Array<string> = entity.constraintIds || [];
            const myIdx = getMappedDayIdx(entityType, entityId);
            if (myIdx === -1) return;

            const myDay = state.days[linearDays[myIdx]];
            if (!myDay) return;

            cIds.forEach((cId) => {
                const c = constraints[cId];
                if (!c) return;

                if (c.type === ConstraintType.Temporal) {
                    if (
                        c.allowedDays &&
                        !c.allowedDays.includes(myDay.dayIndex)
                    ) {
                        if (!v[entityId]) v[entityId] = [];
                        v[entityId].push("מפר ימי עבודה מותרים");
                    }
                    if (
                        c.forbiddenDays &&
                        c.forbiddenDays.includes(myDay.dayIndex)
                    ) {
                        if (!v[entityId]) v[entityId] = [];
                        v[entityId].push("מפר ימי עבודה אסורים");
                    }
                } else if (c.type === ConstraintType.Relational) {
                    const targetIdx = getMappedDayIdx(c.targetType, c.targetId);
                    if (targetIdx === -1) return;

                    let isViolated = false;
                    const delta = myIdx - targetIdx;

                    if (c.relation === "after") {
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
                    } else if (c.relation === "before") {
                        if (delta >= 0) isViolated = true;
                    }

                    if (isViolated) {
                        if (!v[entityId]) v[entityId] = [];
                        v[entityId].push(
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
        async (moduleId: string, dayId: string) => {
            await createMapping({ moduleId, eventId: null, dayId });
        },
        [createMapping],
    );

    const handleMapEvent = useCallback(
        async (moduleId: string, eventId: string, dayId: string) => {
            await createMapping({ moduleId, eventId, dayId });
        },
        [createMapping],
    );

    const handleMoveModule = useCallback(
        async (moduleId: string, sourceDayId: string, targetDayId: string) => {
            await moveMapping({
                moduleId,
                eventId: null,
                from: { d: sourceDayId },
                to: { d: targetDayId },
            });
        },
        [moveMapping],
    );

    const handleMoveEvent = useCallback(
        async (
            moduleId: string,
            eventId: string,
            sourceDayId: string,
            targetDayId: string,
        ) => {
            await moveMapping({
                moduleId,
                eventId,
                from: { d: sourceDayId },
                to: { d: targetDayId },
            });
        },
        [moveMapping],
    );

    const handleShiftModule = useCallback(
        async (moduleId: string, deltaDays: number) => {
            if (deltaDays === 0) return;

            const ganttModule = state.modules[moduleId];
            const promises: Array<Promise<void>> = [];

            const mDays = moduleMappings[moduleId] || [];
            mDays.forEach((dayId) => {
                const currentIdx = linearDays.indexOf(dayId);
                const newIdx = currentIdx + deltaDays;
                const targetDayId = linearDays[newIdx];
                if (targetDayId) {
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

            if (ganttModule && ganttModule.events) {
                ganttModule.events.forEach((eventId) => {
                    const currentDayId = eventMappings[eventId];
                    if (currentDayId) {
                        const currentIdx = linearDays.indexOf(currentDayId);
                        const newIdx = currentIdx + deltaDays;
                        const targetDayId = linearDays[newIdx];
                        if (targetDayId) {
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
        [linearDays, state.modules, moduleMappings, eventMappings, moveMapping],
    );

    const handleDragEnd = useCallback(
        async (event: DragEndEvent) => {
            const { active, over } = event;
            if (!over) return;

            const payload = active.data.current;
            const target = over.data.current;

            if (!payload || !target) return;

            if (target.targetType === "remove") {
                if (
                    payload.type === "module-move" ||
                    payload.type === "module-shift"
                ) {
                    const mDays = moduleMappings[payload.moduleId] || [];
                    const promises: Array<Promise<void>> = [];

                    mDays.forEach((d) => {
                        promises.push(
                            removeMapping({
                                moduleId: payload.moduleId,
                                eventId: null,
                                dayId: d,
                            }),
                        );
                    });

                    const ganttModule = state.modules[payload.moduleId];
                    if (ganttModule && ganttModule.events) {
                        ganttModule.events.forEach((eId) => {
                            const d = eventMappings[eId];
                            if (d) {
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
                } else if (payload.type === "event-move") {
                    await removeMapping({
                        moduleId: payload.moduleId,
                        eventId: payload.eventId,
                        dayId: payload.sourceDayId,
                    });
                }
                return;
            }

            if (
                payload.type === "module-map" &&
                target.targetType === "module"
            ) {
                await handleMapModule(payload.moduleId, target.dayId);
            } else if (
                payload.type === "event-map" &&
                target.targetType === "event"
            ) {
                await handleMapEvent(
                    payload.moduleId,
                    payload.eventId,
                    target.dayId,
                );
            } else if (
                payload.type === "module-move" &&
                target.targetType === "module"
            ) {
                if (payload.sourceDayId !== target.dayId) {
                    await handleMoveModule(
                        payload.moduleId,
                        payload.sourceDayId,
                        target.dayId,
                    );
                }
            } else if (
                payload.type === "module-shift" &&
                target.targetType === "module"
            ) {
                const sourceIdx = linearDays.indexOf(payload.sourceDayId);
                const targetIdx = linearDays.indexOf(target.dayId);
                const deltaDays = targetIdx - sourceIdx;

                if (deltaDays !== 0) {
                    await handleShiftModule(payload.moduleId, deltaDays);
                }
            } else if (
                payload.type === "event-move" &&
                target.targetType === "event"
            ) {
                if (payload.sourceDayId !== target.dayId) {
                    await handleMoveEvent(
                        payload.moduleId,
                        payload.eventId,
                        payload.sourceDayId,
                        target.dayId,
                    );
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
            state.modules,
        ],
    );

    // Memoized so context consumers (every day cell) don't re-render on unrelated
    // parent renders (#88).
    const contextValue = useMemo(
        () => ({
            weeklyView,
            showConstraints,
            startDate: curriculum?.startDate ?? null,
            timelineWeeks,
            linearDays,
            moduleMappings,
            eventMappings,
            curriculumMappings,
            eventSpans,
            scheduledMinutesByDay,
            violations,
            dayCellWidth,
            zoomedWeekId,
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
            curriculum?.startDate,
            timelineWeeks,
            linearDays,
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

    if (!curriculum) {
        return <Typography sx={{ p: 2 }}>טוען גאנט...</Typography>;
    }

    return (
        <DndContext
            measuring={{
                droppable: { strategy: MeasuringStrategy.WhileDragging },
            }}
            onDragEnd={handleDragEnd}
            sensors={sensors}
        >
            <GanttContext.Provider value={contextValue}>
                <Box sx={{ width: "100%", overflow: "hidden", mt: 2 }}>
                    <Paper
                        elevation={0}
                        sx={{
                            width: "100%",
                            maxHeight: "calc(100vh - 180px)",
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                        }}
                    >
                        <Box
                            sx={{
                                p: 2,
                                borderBottom: `1px solid ${theme.vars.palette.divider}`,
                                flexShrink: 0,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                            }}
                        >
                            <Box>
                                <Typography variant="h6">
                                    {curriculum.title}
                                </Typography>
                                <Typography
                                    color="text.secondary"
                                    variant="body2"
                                >
                                    {curriculum.description}
                                </Typography>
                            </Box>
                            <Stack
                                alignItems="center"
                                direction="row"
                                spacing={1}
                                sx={{
                                    flexWrap: "wrap",
                                    justifyContent: "flex-end",
                                    rowGap: 1,
                                }}
                            >
                                {/* View mode: weekly / daily */}
                                <ToggleButtonGroup
                                    aria-label="מצב תצוגה"
                                    exclusive
                                    onChange={(_, value) => {
                                        if (value)
                                            handleWeeklyViewChange(
                                                value === "week",
                                            );
                                    }}
                                    size="small"
                                    value={weeklyView ? "week" : "day"}
                                >
                                    <ToggleButton
                                        aria-label="תצוגה שבועית"
                                        sx={{ gap: 0.5, px: 1.5 }}
                                        value="week"
                                    >
                                        <CalendarViewWeekIcon fontSize="small" />
                                        שבועי
                                    </ToggleButton>
                                    <ToggleButton
                                        aria-label="תצוגה יומית"
                                        sx={{ gap: 0.5, px: 1.5 }}
                                        value="day"
                                    >
                                        <CalendarViewDayIcon fontSize="small" />
                                        יומי
                                    </ToggleButton>
                                </ToggleButtonGroup>

                                {/* Display options: constraints / unallocated */}
                                <ToggleButtonGroup
                                    aria-label="אפשרויות תצוגה"
                                    onChange={(_, values: Array<string>) => {
                                        setShowConstraints(
                                            values.includes("constraints"),
                                        );
                                        setShowUnallocated(
                                            values.includes("unallocated"),
                                        );
                                    }}
                                    size="small"
                                    value={[
                                        ...(showConstraints
                                            ? ["constraints"]
                                            : []),
                                        ...(showUnallocated
                                            ? ["unallocated"]
                                            : []),
                                    ]}
                                >
                                    <ToggleButton
                                        aria-label="הצגת אילוצים"
                                        sx={{ gap: 0.5, px: 1.5 }}
                                        value="constraints"
                                    >
                                        <RuleIcon fontSize="small" />
                                        אילוצים
                                    </ToggleButton>
                                    <ToggleButton
                                        aria-label="הצגת פערי שיבוץ"
                                        sx={{ gap: 0.5, px: 1.5 }}
                                        value="unallocated"
                                    >
                                        <Badge
                                            badgeContent={unallocatedCount}
                                            color="warning"
                                            max={999}
                                            overlap="circular"
                                        >
                                            <PendingActionsIcon fontSize="small" />
                                        </Badge>
                                        לא משובצים
                                    </ToggleButton>
                                </ToggleButtonGroup>

                                <Divider flexItem orientation="vertical" />

                                {/* Row actions */}
                                <Tooltip
                                    title={
                                        allCollapsed ? "הרחב הכל" : "כווץ הכל"
                                    }
                                >
                                    <IconButton
                                        aria-label={
                                            allCollapsed ? "הרחב הכל" : "כווץ הכל"
                                        }
                                        onClick={
                                            allCollapsed
                                                ? expandAllSyllabuses
                                                : collapseAllSyllabuses
                                        }
                                        size="small"
                                    >
                                        {allCollapsed ? (
                                            <UnfoldMoreIcon />
                                        ) : (
                                            <UnfoldLessIcon />
                                        )}
                                    </IconButton>
                                </Tooltip>
                                {zoomedWeekId ? (
                                    <Tooltip title="הצגת כל השבועות">
                                        <IconButton
                                            aria-label="הצגת כל השבועות"
                                            color="primary"
                                            onClick={() =>
                                                setZoomedWeekId(null)
                                            }
                                            size="small"
                                        >
                                            <ZoomOutMapIcon />
                                        </IconButton>
                                    </Tooltip>
                                ) : null}
                            </Stack>
                        </Box>

                        {showUnallocated ? (
                            <Box
                                sx={{
                                    px: 2,
                                    py: 1.5,
                                    borderBottom: `1px solid ${theme.vars.palette.divider}`,
                                    backgroundColor:
                                        theme.vars.palette.background.paper,
                                    flexShrink: 0,
                                    maxHeight: 200,
                                    overflow: "auto",
                                }}
                            >
                                {unallocatedBySyllabus.length === 0 ? (
                                    <Typography
                                        color="text.secondary"
                                        variant="body2"
                                    >
                                        כל המערכים והמפגשים משובצים 🎉
                                    </Typography>
                                ) : (
                                    <Stack spacing={1}>
                                        {unallocatedBySyllabus.map((group) => (
                                            <Box key={group.syllabusId}>
                                                <Typography
                                                    fontWeight="bold"
                                                    variant="caption"
                                                >
                                                    {group.syllabusTitle}
                                                </Typography>
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        flexWrap: "wrap",
                                                        gap: 0.5,
                                                        mt: 0.5,
                                                    }}
                                                >
                                                    {group.modules.map((m) => (
                                                        <Chip
                                                            clickable
                                                            color="primary"
                                                            key={m.id}
                                                            label={m.title}
                                                            onClick={() =>
                                                                revealItem(
                                                                    group.syllabusId,
                                                                    m.id,
                                                                )
                                                            }
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    ))}
                                                    {group.events.map((e) => (
                                                        <Chip
                                                            clickable
                                                            key={e.id}
                                                            label={e.title}
                                                            onClick={() =>
                                                                revealItem(
                                                                    group.syllabusId,
                                                                    e.moduleId,
                                                                    e.id,
                                                                )
                                                            }
                                                            size="small"
                                                            variant="outlined"
                                                        />
                                                    ))}
                                                </Box>
                                            </Box>
                                        ))}
                                    </Stack>
                                )}
                            </Box>
                        ) : null}

                        <Box
                            sx={{
                                flexGrow: 1,
                                position: "relative",
                                overflow: "hidden",
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            <TableContainer
                                ref={containerRef}
                                sx={{
                                    width: "100%",
                                    height: "100%",
                                    overflow: "auto",
                                    pb: 3,
                                }}
                            >
                                <Table
                                    size="small"
                                    stickyHeader
                                    sx={{
                                        width: "max-content",
                                        minWidth: "100%",
                                        tableLayout: "fixed",
                                    }}
                                >
                                    <GanttHeader />
                                    <TableBody>
                                        {curriculum.syllabuses.map(
                                            (syllabusId) => (
                                                <GanttSyllabusGroup
                                                    key={syllabusId}
                                                    syllabusId={syllabusId}
                                                />
                                            ),
                                        )}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            {showConstraints ? (
                                <ConstraintLines
                                    containerRef={containerRef}
                                    links={activeLinks}
                                />
                            ) : null}
                        </Box>
                    </Paper>
                </Box>
            </GanttContext.Provider>
        </DndContext>
    );
};
