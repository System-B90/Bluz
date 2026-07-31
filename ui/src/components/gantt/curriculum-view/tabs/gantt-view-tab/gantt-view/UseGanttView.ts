import { useMemo, useState } from "react";

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
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/provider";
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

    const [ showConstraints, setShowConstraints ] = useState(true);
    const [ relativeDaySizing, setRelativeDaySizing ] = useState(false);
    const [ showUnallocated, setShowUnallocated ] = useState(false);

    const {
        allCollapsed,
        collapseAllSyllabuses,
        expandAllSyllabuses,
        expandModuleFor,
        exposeSyllabusFor,
        isModuleExpanded,
        isSyllabusExpanded,
        toggleModule,
        toggleSyllabus,
    } = useGanttExpansion(curriculum?.syllabuses ?? []);

    const { revealItem } = useGanttReveal({
        exposeSyllabusFor,
        expandModuleFor,
        registerRevealHandler,
    });

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

    const { curriculumMappings, eventMappings, moduleMappings } = useGanttMappingsMerge(
        globalMappings,
        curriculumId,
    );

    const { eventSpans, scheduledMinutesByDay } = useGanttScheduling({
        curriculumMappings,
        eventMappings,
        linearDays,
        recurrenceExceptionState,
        state,
    });

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
