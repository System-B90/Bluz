import { useCallback, useMemo } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { useCourses } from "@/components/base/CoursesProvider";
import { getDayDate } from "@/components/gantt/curriculum-view/gantt-time-utils";
import { defaultExpandedSyllabusIds } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/default-expansion";
import { buildDragLabels } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/drag-labels";
import { dropWarningFor } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/drop-warning";
import {
    timelineIgnoreBreaks,
    timelineRelativeDaySizing,
    timelineShowConstraints,
    timelineShowUnallocated,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/timeline-preferences";
import { GanttContextType } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import { useGanttDrag } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-drag";
import { useGanttExpansion } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-expansion";
import { useGanttMappingsMerge } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-mappings-merge";
import { useGanttReveal } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-reveal";
import { useGanttScheduling } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-scheduling";
import { useGanttSearch } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-search";
import { useGanttUnallocated } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-unallocated";
import { useGanttViolations } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-violations";
import { useGanttZoom } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/use-gantt-zoom";
import { useGanttConstraints } from "@/components/gantt/state/constraints/hooks";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/context";
import { CreateMapping } from "@/components/gantt/state/mappings/context";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import { useGanttRecurrenceExceptions } from "@/components/gantt/state/recurrence-exceptions/hooks";

// Orchestrates the Gantt view's sub-hooks (search, expansion, scheduling,
// constraint violations, unallocated panel, drag) and assembles the memoized
// context value consumed by the row tree (#225).
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
    const { deleteOccurrence, restoreOccurrence } = useGanttRecurrenceExceptions();
    const {
        state: { constraints },
    } = useGanttConstraints();
    const curriculum = state.curriculums[ curriculumId ];

    const {
        containerRef,
        weeklyView,
        setWeeklyView,
        handleWeeklyViewChange,
        zoomedWeekId,
        setZoomedWeekId,
        timelineWeeks,
        linearDays,
        allLinearDays,
        dayIndexMap,
        weekIndexByDayId,
        weekIndexOffset,
        dayCellWidth,
        singleWeekDayZoom,
    } = useGanttZoom({ curriculum, weeksById: state.weeks });

    // Calendar date of every visible day, so the recurrence window can be
    // evaluated against real dates rather than week indices (#468).
    const dateByDayId = useMemo(() =>
    {
        const map = new Map<string, string>();
        const startDate = curriculum?.startDate ?? null;
        if (!startDate) return map;

        timelineWeeks.forEach((week, weekIdx) =>
        {
            week.days.forEach((dayId) =>
            {
                const day = state.days[ dayId ];
                if (!day) return;
                const date = getDayDate(
                    startDate,
                    weekIdx + weekIndexOffset,
                    day.dayIndex,
                );
                if (date) map.set(dayId, date.format("YYYY-MM-DD"));
            });
        });
        return map;
    }, [ curriculum?.startDate, timelineWeeks, weekIndexOffset, state.days ]);

    const dateOfDayId = useCallback(
        (dayId: string) => dateByDayId.get(dayId),
        [ dateByDayId ],
    );

    // Remembered across reloads (#821).
    const showConstraints = timelineShowConstraints.use();
    const setShowConstraints = timelineShowConstraints.set;
    const relativeDaySizing = timelineRelativeDaySizing.use();
    const setRelativeDaySizing = timelineRelativeDaySizing.set;
    const showUnallocated = timelineShowUnallocated.use();
    const setShowUnallocated = timelineShowUnallocated.set;
    const ignoreBreaks = timelineIgnoreBreaks.use();
    const setIgnoreBreaks = timelineIgnoreBreaks.set;

    const {
        isEventVisible,
        isModuleVisible,
        isSyllabusVisible,
        searchActive,
        searchQuery,
        setSearchQuery,
    } = useGanttSearch({
        curriculum,
        events: state.events,
        modules: state.modules,
        syllabuses: state.syllabuses,
    });

    const { userData } = useAuth();
    const { courses } = useCourses();
    const syllabusIds = curriculum?.syllabuses;
    const hiveUserId = userData?.id ? Number(userData.id) : null;
    const defaultExpanded = useMemo(
        () => defaultExpandedSyllabusIds(syllabusIds ?? [], state, courses, hiveUserId),
        [ syllabusIds, state, courses, hiveUserId ],
    );

    const {
        allCollapsed,
        collapseAllSyllabuses,
        expandAllSyllabuses,
        expandModuleFor,
        exposeSyllabusFor,
        isModuleExpanded,
        isSyllabusExpanded,
        setAllRows,
        toggleModule,
        toggleSyllabus,
    } = useGanttExpansion(syllabusIds ?? [], searchActive, defaultExpanded);

    const { revealItem } = useGanttReveal({
        exposeSyllabusFor,
        expandModuleFor,
        registerRevealHandler,
    });

    const { curriculumMappings, eventMappings: anyEventMappings, moduleMappings } = useGanttMappingsMerge(
        globalMappings,
        curriculumId,
    );

    const { eventSpans, studentLoadByDay, studentLoadWithBreaksByDay, studentPaths } = useGanttScheduling({
        curriculum,
        ignoreBreaks,
        state,
    });

    // An event mapped onto several days is anchored on its earliest one.
    const eventMappings = useMemo(() => ({
        ...anyEventMappings,
        ...Object.fromEntries(Object.entries(eventSpans).map(([ eventId, span ]) => [ eventId, span.dayIds[ 0 ] ])),
    }), [ anyEventMappings, eventSpans ]);

    const { unallocatedBySyllabus, unallocatedCount } = useGanttUnallocated({
        curriculum,
        eventMappings,
        events: state.events,
        moduleMappings,
        modules: state.modules,
        syllabuses: state.syllabuses,
    });

    const { violations, activeLinks } = useGanttViolations({
        constraints,
        days: state.days,
        eventMappings,
        events: state.events,
        linearDays,
        moduleMappings,
        modules: state.modules,
    });

    // Placing an event allots its whole duration on that day.
    const createFullMapping = useCallback<CreateMapping>(
        (args) => createMapping({
            allottedMinutes: args.eventId ? state.events[ args.eventId ]?.minimumDuration ?? 0 : 0,
            ...args,
        }),
        [ createMapping, state.events ],
    );

    // Names and days for drop snackbars, undo and drag announcements.
    const dragLabels = useMemo(() => buildDragLabels({
        modules: state.modules,
        events: state.events,
        days: state.days,
        dateOfDayId,
    }), [ state.modules, state.events, state.days, dateOfDayId ]);

    const {
        handleDragEnd,
        handleMapModule,
        handleMapEvent,
        handleMoveModule,
        handleMoveEvent,
        handleShiftModule,
        planShift,
    } = useGanttDrag({
        linearDays,
        modulesById: state.modules,
        moduleMappings,
        eventMappings,
        createMapping: createFullMapping,
        moveMapping,
        removeMapping,
        deleteOccurrence,
        restoreOccurrence,
        labels: dragLabels,
    });

    const getDropWarning = useCallback<GanttContextType[ "getDropWarning" ]>(
        (payload, target) => dropWarningFor(payload, target, {
            constraints,
            modules: state.modules,
            events: state.events,
            days: state.days,
            eventMappings,
            linearDays,
            planShift,
            alignment: { syllabuses: state.syllabuses, modules: state.modules, events: state.events },
        }),
        [ constraints, state.syllabuses, state.modules, state.events, state.days, eventMappings, linearDays, planShift ],
    );

    // Memoized so context consumers (every day cell) don't re-render on unrelated
    // parent renders (#88).
    const contextValue = useMemo(
        () => ({
            weeklyView,
            setWeeklyView,
            relativeDaySizing,
            startDate: curriculum?.startDate ?? null,
            timelineWeeks,
            linearDays,
            allLinearDays,
            ignoreBreaks,
            dayIndexMap,
            weekIndexByDayId,
            dateOfDayId,
            moduleMappings,
            eventMappings,
            curriculumMappings,
            eventSpans,
            studentLoadByDay,
            studentLoadWithBreaksByDay,
            studentPaths,
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
            setAllRows,
            searchActive,
            isSyllabusVisible,
            isModuleVisible,
            isEventVisible,
            onMapModule: handleMapModule,
            onMapEvent: handleMapEvent,
            onMoveModule: handleMoveModule,
            onMoveEvent: handleMoveEvent,
            onShiftModule: handleShiftModule,
            getDropWarning,
        }),
        [
            weeklyView,
            setWeeklyView,
            relativeDaySizing,
            curriculum?.startDate,
            timelineWeeks,
            linearDays,
            allLinearDays,
            ignoreBreaks,
            dayIndexMap,
            weekIndexByDayId,
            dateOfDayId,
            moduleMappings,
            eventMappings,
            curriculumMappings,
            eventSpans,
            studentLoadByDay,
            studentLoadWithBreaksByDay,
            studentPaths,
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
            setAllRows,
            searchActive,
            isSyllabusVisible,
            isModuleVisible,
            isEventVisible,
            handleMapModule,
            handleMapEvent,
            handleMoveModule,
            handleMoveEvent,
            handleShiftModule,
            getDropWarning,
        ],
    );

    return {
        curriculum,
        containerRef,
        contextValue,
        handleDragEnd,
        dragLabels,
        showConstraints,
        setShowConstraints,
        weeklyView,
        handleWeeklyViewChange,
        relativeDaySizing,
        setRelativeDaySizing,
        ignoreBreaks,
        setIgnoreBreaks,
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
