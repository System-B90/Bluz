import
{
    CollisionDetection,
    defaultDropAnimationSideEffects,
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    pointerWithin,
    rectIntersection,
    useDroppable,
} from "@dnd-kit/core";
import LayersIcon from "@mui/icons-material/Layers";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";
import { createPortal } from "react-dom";

import { Course } from "@/api-shared/types/course";
import { CourseUser } from "@/api-shared/types/hive";
import { useCourses } from "@/components/base/CoursesProvider";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { SettingsAddButton } from "@/components/settings-dialog/tabs/global/common/AddButton";
import { iconBadgeSx, settingsCardSx } from "@/components/settings-dialog/tabs/global/common/styles";
import { CourseItem } from "@/components/settings-dialog/tabs/global/course-settings/CourseItem";
import
{
    DraggedItemData,
    DropTargetCourseData,
    DropTargetRootData,
} from "@/components/settings-dialog/tabs/global/course-settings/dnd-types";
import
{
    InstructorCard,
    InstructorSourceList,
} from "@/components/settings-dialog/tabs/global/course-settings/InstructorSourceList";

const dropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: {
            active: {
                opacity: "0.5",
            },
        },
    }),
};

function InstructorDragOverlay({
    activeId,
    instructors,
}: {
    activeId: string;
    instructors: Array<CourseUser>;
})
{
    const inst = instructors.find((i) => `instructor-${i.id}` === activeId);
    if (!inst) return null;
    return <InstructorCard instructor={ inst } isOverlay />;
}

function CourseDragOverlay({
    activeId,
    courses,
}: {
    activeId: string;
    courses: Array<Course>;
})
{
    const course = courses.find((c) => `course-${c.id}` === activeId);
    if (!course) return null;
    return (
        <Card
            sx={ (theme) => ({
                p: 1.5,
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                borderRadius: "16px",
                border: "1px solid",
                borderColor: "secondary.main",
                boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",
                bgcolor: "#ffffff",
                cursor: "grabbing",
                ...theme.applyStyles("dark", { bgcolor: "rgba(255, 255, 255, 0.05)" }),
            }) }
        >
            <Box
                sx={ {
                    width: "18px",
                    height: "18px",
                    borderRadius: "50%",
                    bgcolor: course.color ?? "#e0e0e0",
                    border: "1px solid",
                    borderColor: "divider",
                } }
            />
            <Typography
                sx={ {
                    fontWeight: 700,
                    fontSize: "0.88rem",
                    color: "text.primary",
                } }
            >
                { course.name }
            </Typography>
        </Card>
    );
}

/**
 * Resolve the drop from the pointer first. The default (largest rect overlap)
 * lets a tall neighbouring course card outscore the short root drop zone the
 * pointer is actually over, so un-nesting silently did nothing.
 */
const pointerFirstCollision: CollisionDetection = (args) =>
{
    const hits = pointerWithin(args);
    return hits.length > 0 ? hits : rectIntersection(args);
};

function RootDropZone()
{
    const { isOver, setNodeRef } = useDroppable({
        id: "root-dropzone",
        data: { type: "ROOT_DROP" } as DropTargetRootData,
    });

    return (
        <Box
            ref={ setNodeRef }
            sx={ (theme) => ({
                border: "2px dashed",
                borderColor: isOver ? "secondary.main" : "divider",
                borderRadius: "12px",
                p: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 1,
                width: "100%",
                bgcolor: isOver ? "action.selected" : "rgba(0, 0, 0, 0.01)",
                transition: "all 0.25s ease",
                ...(isOver
                    ? {}
                    : theme.applyStyles("dark", { bgcolor: "rgba(255, 255, 255, 0.01)" })),
            }) }
        >
            <SwapHorizIcon
                sx={ {
                    color: isOver ? "secondary.main" : "text.secondary",
                    fontSize: 20,
                } }
            />
            <Typography
                sx={ {
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    color: isOver ? "secondary.main" : "text.secondary",
                    whiteSpace: "nowrap",
                } }
            >
                { isOver ? "שחרר כאן לראשי" : "גרור להוצאה מהיררכיה" }
            </Typography>
        </Box>
    );
}

export function CourseSettings()
{
    const { courses, addCourse, updateCoursePartial } = useCourses();
    const { instructors } = useHiveUsers();
    const { enqueueSnackbar } = useSnackbar();

    const [ activeDrag, setActiveDrag ] = useState<{
        id: string;
        type: "COURSE" | "INSTRUCTOR";
        data: DraggedItemData;
    } | null>(null);

    const handleCreate = useCallback(() =>
    {
        void addCourse({
            name: "מסלול חדש",
            color: "#67C8DD", // Brand turquoise as default
            parentId: null,
            instructorIds: [],
        });
    }, [ addCourse ]);

    const handleDragStart = useCallback((event: DragStartEvent) =>
    {
        const { active } = event;
        const data = active.data.current as DraggedItemData | undefined;
        if (data)
        {
            setActiveDrag({
                id: active.id as string,
                type: data.type,
                data,
            });
        }
    }, []);

    const handleDragCancel = useCallback(() =>
    {
        setActiveDrag(null);
    }, []);

    const handleDragEnd = useCallback(
        (event: DragEndEvent) =>
        {
            setActiveDrag(null);
            const { active, over } = event;
            if (!over) return;

            const activeData = active.data.current as
                | DraggedItemData
                | undefined;
            const overData = over.data.current as
                | DropTargetCourseData
                | DropTargetRootData
                | undefined;

            if (!activeData || !overData) return;

            // Handle Instructor Drag & Drop
            if (activeData.type === "INSTRUCTOR")
            {
                if (overData.type === "COURSE_DROP")
                {
                    const targetCourseId = overData.targetCourseId;
                    const courseObj = courses.find(
                        (c) => c.id === targetCourseId,
                    );
                    if (courseObj)
                    {
                        const currentIds = courseObj.instructorIds ?? [];
                        if (!currentIds.includes(activeData.instructorId))
                        {
                            void updateCoursePartial(targetCourseId, {
                                instructorIds: [
                                    ...currentIds,
                                    activeData.instructorId,
                                ],
                            });
                        }
                    }
                }
            }

            // Handle Course Nesting Drag & Drop
            if (activeData.type === "COURSE")
            {
                const draggedId = activeData.courseId;

                // Move back to Root level
                if (overData.type === "ROOT_DROP")
                {
                    const courseObj = courses.find((c) => c.id === draggedId);
                    if (courseObj?.parentId)
                    {
                        void updateCoursePartial(draggedId, { parentId: null });
                    }
                    return;
                }

                // Nest under another course
                if (overData.type === "COURSE_DROP")
                {
                    const targetId = overData.targetCourseId;

                    if (draggedId === targetId) return;

                    // Cycle Detection: check if target is a descendant of dragged course
                    const hasCycle = (
                        dragId: string,
                        destId: string,
                    ): boolean =>
                    {
                        let current = courses.find((c) => c.id === destId);
                        while (current)
                        {
                            if (current.parentId === dragId) return true;
                            const parentId = current.parentId;
                            current = parentId
                                ? courses.find((c) => c.id === parentId)
                                : undefined;
                        }
                        return false;
                    };

                    if (hasCycle(draggedId, targetId))
                    {
                        enqueueSnackbar(
                            "שגיאה: לא ניתן להכניס מסלול אב לתוך אחד מצאצאיו!",
                            {
                                variant: "error",
                                autoHideDuration: 4000,
                            },
                        );
                        return;
                    }

                    // Perform move
                    void updateCoursePartial(draggedId, { parentId: targetId });
                }
            }
        },
        [ courses, updateCoursePartial, enqueueSnackbar ],
    );

    // Identify top-level courses (courses without valid parents present in the list)
    const rootCourses = courses.filter(
        (c) =>
            !c.parentId || !courses.some((parent) => parent.id === c.parentId),
    );

    return (
        <DndContext
            collisionDetection={ pointerFirstCollision }
            onDragCancel={ handleDragCancel }
            onDragEnd={ handleDragEnd }
            onDragStart={ handleDragStart }
        >
            <Box
                sx={ (theme) => ({
                    ...settingsCardSx(theme),
                    flexDirection: "row",
                    height: "100%",
                    minHeight: 380,
                    overflow: "hidden",
                    alignItems: "stretch",
                    p: 0,
                    gap: 0,
                }) }
            >
                {/* Available Instructors Side Drawer Panel */ }
                <InstructorSourceList />

                {/* Courses Hierarchy Content Pane */ }
                <Box
                    sx={ {
                        flexGrow: 1,
                        p: 3,
                        display: "flex",
                        flexDirection: "column",
                        minWidth: 0,
                    } }
                >
                    {/* Header */ }
                    <Box alignItems="center" display="flex" gap={ 1.5 } mb={ 2.5 }>
                        <Box sx={ iconBadgeSx("secondary") }>
                            <LayersIcon className="text-[20px]" />
                        </Box>
                        <Box>
                            <Typography
                                sx={ {
                                    fontWeight: 800,
                                    fontSize: "1.1rem",
                                    color: "text.primary",
                                } }
                            >
                                היררכיית מסלולים ומדריכים
                            </Typography>
                            <Typography
                                sx={ {
                                    fontSize: "0.75rem",
                                    color: "text.secondary",
                                } }
                            >
                                הגדרת מבנה ההיררכיה ושיוך מדריכים למסלולים
                            </Typography>
                        </Box>
                    </Box>

                    {/* Hierarchy Scrollable Tree */ }
                    <Box
                        sx={ {
                            display: "flex",
                            flexDirection: "column",
                            gap: 1.5,
                            flexGrow: 1,
                            overflowY: "auto",
                            overflowX: "hidden",
                            pr: 0.5,
                            mb: 2,
                        } }
                    >
                        { rootCourses.map((course) => (
                            <CourseItem
                                allCourses={ courses }
                                course={ course }
                                key={ course.id }
                            />
                        )) }

                        { courses.length === 0 && (
                            <Typography
                                align="center"
                                sx={ {
                                    color: "text.secondary",
                                    fontSize: "0.85rem",
                                    mt: 6,
                                } }
                            >
                                לא הוגדרו מסלולים. יש ללחוץ על הכפתור למטה ליצירת
                                מסלול.
                            </Typography>
                        ) }
                    </Box>

                    {/* Bottom Actions Row */ }
                    <Box
                        sx={ {
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "stretch",
                            gap: 1.5,
                            borderTop: "1px solid",
                            borderColor: "divider",
                            pt: 2,
                        } }
                    >
                        {/* Create Course Button */ }
                        <Box sx={ { flex: 1, display: "flex" } }>
                            <SettingsAddButton label="יצירת מסלול ראשי חדש" onClick={ handleCreate } />
                        </Box>

                        {/* Un-nest / Move to Root Droppable Area */ }
                        { courses.some((c) => c.parentId) ? (
                            <Box sx={ { flex: 1.2, display: "flex" } }>
                                <RootDropZone />
                            </Box>
                        ) : null }
                    </Box>
                </Box>
            </Box>
            { /* Portalled to <body>: inside the dialog, MUI's transformed Paper
                becomes the containing block for the overlay's position: fixed,
                so the preview (and the rect dnd-kit collides with) drifted away
                from the pointer. A modifier subtracting the paper's offset only
                approximated that and broke when the paper moved (#648). */ }
            { typeof document !== "undefined" ? createPortal(
                <DragOverlay dropAnimation={ dropAnimation } zIndex={ 2000 }>
                    { activeDrag ? (
                        activeDrag.type === "INSTRUCTOR" ? (
                            <InstructorDragOverlay
                                activeId={ activeDrag.id }
                                instructors={ instructors }
                            />
                        ) : (
                            <CourseDragOverlay
                                activeId={ activeDrag.id }
                                courses={ courses }
                            />
                        )
                    ) : null }
                </DragOverlay>,
                document.body,
            ) : null }
        </DndContext>
    );
}
