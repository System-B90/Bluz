import
{
    DndContext,
    MeasuringStrategy,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import Box from "@mui/material/Box";
import Paper from "@mui/material/Paper";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import Typography from "@mui/material/Typography";
import React from "react";

import { ConstraintLines } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/ConstraintLines";
import { GanttContext } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/context";
import { GanttHeader } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttHeader";
import { GanttSyllabusGroup } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttSyllabusGroup";
import { GanttToolbar } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttToolbar";
import { GanttUnallocatedPanel } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttUnallocatedPanel";
import { GanttViewProps } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";
import { useGanttView } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/useGanttView";

export const GanttView: React.FC<GanttViewProps> = ({ curriculumId }) =>
{
    const {
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
    } = useGanttView(curriculumId);

    // Require a small drag distance before activating, so a click never pays the
    // (day-view) droppable measurement cost and drags feel intentional (#88).
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    );

    if (!curriculum)
    {
        return <Typography sx={ { p: 2 } }>טוען גאנט...</Typography>;
    }

    return (
        <DndContext
            measuring={ {
                droppable: { strategy: MeasuringStrategy.WhileDragging },
            } }
            onDragEnd={ handleDragEnd }
            sensors={ sensors }
        >
            <GanttContext.Provider value={ contextValue }>
                <Box sx={ { width: "100%", overflow: "hidden", mt: 2 } }>
                    <Paper
                        elevation={ 0 }
                        sx={ {
                            width: "100%",
                            maxHeight: "calc(100vh - 180px)",
                            display: "flex",
                            flexDirection: "column",
                            overflow: "hidden",
                        } }
                    >
                        <GanttToolbar
                            allCollapsed={ allCollapsed }
                            collapseAllSyllabuses={ collapseAllSyllabuses }
                            description={ curriculum.description }
                            expandAllSyllabuses={ expandAllSyllabuses }
                            onWeeklyViewChange={ handleWeeklyViewChange }
                            relativeDaySizing={ relativeDaySizing }
                            setRelativeDaySizing={ setRelativeDaySizing }
                            setShowConstraints={ setShowConstraints }
                            setShowUnallocated={ setShowUnallocated }
                            setZoomedWeekId={ setZoomedWeekId }
                            showConstraints={ showConstraints }
                            showUnallocated={ showUnallocated }
                            title={ curriculum.title }
                            unallocatedCount={ unallocatedCount }
                            weeklyView={ weeklyView }
                            zoomedWeekId={ zoomedWeekId }
                        />

                        { showUnallocated ? (
                            <GanttUnallocatedPanel
                                onReveal={ revealItem }
                                unallocatedBySyllabus={ unallocatedBySyllabus }
                            />
                        ) : null }

                        <Box
                            sx={ {
                                flexGrow: 1,
                                position: "relative",
                                overflow: "hidden",
                                display: "flex",
                                flexDirection: "column",
                            } }
                        >
                            <TableContainer
                                ref={ containerRef }
                                sx={ {
                                    width: "100%",
                                    height: "100%",
                                    overflow: "auto",
                                    pb: 3,
                                } }
                            >
                                <Table
                                    size="small"
                                    stickyHeader
                                    sx={ {
                                        width: "max-content",
                                        minWidth: "100%",
                                        tableLayout: "fixed",
                                    } }
                                >
                                    <GanttHeader />
                                    <TableBody>
                                        { curriculum.syllabuses.map(
                                            (syllabusId) => (
                                                <GanttSyllabusGroup
                                                    key={ syllabusId }
                                                    syllabusId={ syllabusId }
                                                />
                                            ),
                                        ) }
                                    </TableBody>
                                </Table>
                            </TableContainer>
                            { showConstraints ? (
                                <ConstraintLines
                                    containerRef={ containerRef }
                                    links={ activeLinks }
                                />
                            ) : null }
                        </Box>
                    </Paper>
                </Box>
            </GanttContext.Provider>
        </DndContext>
    );
};
