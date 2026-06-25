import { useDraggable, useDroppable } from "@dnd-kit/core";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditIcon from "@mui/icons-material/Edit";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import {
    MuiColorInput,
    MuiColorInputColors,
    MuiColorInputProps,
} from "mui-color-input";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Course } from "@/api-shared/types/course";
import { useCourses } from "@/components/base/CoursesProvider";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { HiveAvatar } from "@/components/header/HiveAvatarImage";
import {
    DraggedCourseData,
    DropTargetCourseData,
} from "@/components/settings-dialog/tabs/global/course-settings/dnd-types";

type CourseItemProps = {
    course: Course;
    allCourses: Array<Course>;
    depth?: number;
    visited?: Set<string>;
};

export function CourseItem({
    course,
    allCourses,
    depth = 0,
    visited = new Set<string>(),
}: CourseItemProps) {
    const hasVisited = visited.has(course.id);

    const nextVisited = new Set(visited);
    nextVisited.add(course.id);

    const { addCourse, updateCoursePartial, deleteCourse } = useCourses();
    const { instructors, getInstructor } = useHiveUsers();

    const [title, setTitle] = useState<string>(course.name);
    const [color, setColor] = useState<string>(course.color ?? "#e0e0e0");
    const [isEditing, setIsEditing] = useState<boolean>(false);
    const [isExpanded, setIsExpanded] = useState<boolean>(true);

    // Instructor Quick-Add Menu State
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const isMenuOpen = Boolean(anchorEl);

    // Debounce for color picker to avoid server commits on every pixel change
    const colorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    useEffect(() => () => {
        if (colorTimeoutRef.current) clearTimeout(colorTimeoutRef.current);
    }, []);

    // Filter children courses
    const subCourses = allCourses.filter((c) => c.parentId === course.id);
    const assignedIds = useMemo(
        () => course.instructorIds ?? [],
        [course.instructorIds],
    );

    // setup dnd-kit draggable & droppable
    const {
        attributes,
        listeners,
        setNodeRef: setDragRef,
        isDragging,
    } = useDraggable({
        id: `course-${course.id}`,
        data: {
            type: "COURSE",
            courseId: course.id,
        } as DraggedCourseData,
    });

    const { isOver, setNodeRef: setDropRef } = useDroppable({
        id: `drop-course-${course.id}`,
        data: {
            type: "COURSE_DROP",
            targetCourseId: course.id,
        } as DropTargetCourseData,
    });

    const style = {
        opacity: isDragging ? 0.4 : 1,
    };

    const commitTitleChange = useCallback(() => {
        setIsEditing(false);
        const trimmed = title.trim();
        if (trimmed && trimmed !== course.name) {
            void updateCoursePartial(course.id, { name: trimmed });
        } else {
            setTitle(course.name);
        }
    }, [title, course.name, course.id, updateCoursePartial]);

    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            if (event.key === "Enter") {
                commitTitleChange();
            } else if (event.key === "Escape") {
                setIsEditing(false);
                setTitle(course.name);
            }
        },
        [commitTitleChange, course.name],
    );

    const handleColorChange: MuiColorInputProps["onChange"] = useCallback(
        (value: string, colors: MuiColorInputColors) => {
            const hex = colors.hex;
            setColor(hex);
            if (colorTimeoutRef.current) {
                clearTimeout(colorTimeoutRef.current);
            }
            colorTimeoutRef.current = setTimeout(() => {
                void updateCoursePartial(course.id, { color: hex });
            }, 600);
        },
        [course.id, updateCoursePartial],
    );

    const handleCreateSubCourse = useCallback(() => {
        void addCourse({
            name: "מסלול חדש",
            color: course.color || "#67C8DD",
            parentId: course.id,
            instructorIds: [],
        });
        setIsExpanded(true);
    }, [addCourse, course]);

    const handleRemoveInstructor = useCallback(
        (instructorId: number) => {
            const nextIds = assignedIds.filter((id) => id !== instructorId);
            void updateCoursePartial(course.id, { instructorIds: nextIds });
        },
        [assignedIds, course.id, updateCoursePartial],
    );

    const handleAddInstructor = useCallback(
        (instructorId: number) => {
            setAnchorEl(null);
            if (assignedIds.includes(instructorId)) return;
            void updateCoursePartial(course.id, {
                instructorIds: [...assignedIds, instructorId],
            });
        },
        [assignedIds, course.id, updateCoursePartial],
    );

    // Get instructors not yet assigned to this course
    const unassignedInstructors = instructors.filter(
        (inst) => !assignedIds.includes(inst.id),
    );

    if (hasVisited) {
        return null;
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {/* Main Course Card Container */}
            <Box
                className="course-card-container"
                ref={setDropRef}
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    mr: depth > 0 ? 0.5 : 0, // In RTL, indentation works via mr (margin-right)
                    border: "1px solid",
                    borderStyle: isOver ? "dashed" : "solid",
                    borderColor: isOver ? "primary.main" : "divider",
                    bgcolor: (theme) =>
                        isOver
                            ? "action.selected"
                            : theme.palette.mode === "light"
                                ? "rgba(103, 200, 221, 0.04)"
                                : "rgba(255, 255, 255, 0.02)",
                    borderRadius: "16px",
                    p: 1.5,
                    transition: "all 0.2s ease",
                }}
            >
                <Box
                    ref={setDragRef}
                    style={style}
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                    }}
                >
                    {/* Drag Handle */}
                    <Box
                        {...attributes}
                        {...listeners}
                        sx={{
                            cursor: isDragging ? "grabbing" : "grab",
                            display: "flex",
                            alignItems: "center",
                            color: "text.secondary",
                            "&:hover": { color: "text.primary" },
                        }}
                    >
                        <DragIndicatorIcon className="text-[18px]" />
                    </Box>

                    {/* Expand/Collapse Toggle */}
                    <Box
                        sx={{
                            width: 34,
                            display: "flex",
                            justifyContent: "center",
                        }}
                    >
                        {subCourses.length > 0 || assignedIds.length > 0 ? (
                            <Tooltip title={isExpanded ? "כווץ" : "הרחב"}>
                                <IconButton
                                    onClick={() => setIsExpanded(!isExpanded)}
                                    size="small"
                                >
                                    {isExpanded ? (
                                        <KeyboardArrowUpIcon
                                            className="text-[18px]"
                                        />
                                    ) : (
                                        <KeyboardArrowDownIcon
                                            className="text-[18px]"
                                        />
                                    )}
                                </IconButton>
                            </Tooltip>
                        ) : null}
                    </Box>

                    {/* Color Input Dot */}
                    <Box sx={{ display: "flex", alignItems: "center" }}>
                        <MuiColorInput
                            format="hex"
                            fullWidth={false}
                            isAlphaHidden
                            onChange={handleColorChange}
                            PopoverProps={{ sx: { direction: "ltr" } }}
                            size="small"
                            sx={{
                                p: 0,
                                m: 0,
                                width: "18px",
                                height: "18px",
                                minWidth: 0,
                                "& .MuiInputBase-root": {
                                    padding: 0,
                                    width: "18px",
                                    height: "18px",
                                    borderRadius: "50%",
                                    overflow: "hidden",
                                    border: "none",
                                    "& .MuiOutlinedInput-notchedOutline": {
                                        border: "none",
                                    },
                                    "& input": { display: "none" },
                                    "& .MuiInputAdornment-root": {
                                        m: 0,
                                        width: "100%",
                                        height: "100%",
                                    },
                                    "& .MuiButtonBase-root": {
                                        width: "100%",
                                        height: "100%",
                                        borderRadius: "50%",
                                        border: "1px solid rgba(0,0,0,0.15)",
                                        transition: "all 0.2s ease",
                                        "&:hover": { transform: "scale(1.2)" },
                                    },
                                },
                            }}
                            value={color}
                        />
                    </Box>

                    {/* Editable Name Field */}
                    <Box
                        onClick={() => !isEditing && setIsEditing(true)}
                        sx={{
                            flexGrow: 1,
                            display: "flex",
                            alignItems: "center",
                            gap: 0.8,
                            cursor: "pointer",
                            minWidth: 0,
                        }}
                    >
                        {isEditing ? (
                            <InputBase
                                autoFocus
                                onBlur={commitTitleChange}
                                onChange={(e) => setTitle(e.target.value)}
                                onKeyDown={handleKeyDown}
                                sx={{
                                    fontSize: "0.88rem",
                                    fontWeight: 700,
                                    width: "100%",
                                    borderBottom: "1px solid",
                                    borderColor: "primary.main",
                                }}
                                value={title}
                            />
                        ) : (
                            <Box
                                alignItems="center"
                                display="flex"
                                gap={0.5}
                                sx={{
                                    flexGrow: 1,
                                    minWidth: 0,
                                    "&:hover svg": { opacity: 1 },
                                }}
                            >
                                <Typography
                                    noWrap
                                    sx={{
                                        fontWeight: 700,
                                        fontSize: "0.88rem",
                                        userSelect: "none",
                                        color: "text.primary",
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        flexGrow: 1,
                                    }}
                                >
                                    {title}
                                </Typography>
                                <EditIcon
                                    sx={{
                                        fontSize: 11,
                                        color: "text.secondary",
                                        opacity: 0,
                                        transition: "opacity 0.2s ease",
                                        flexShrink: 0,
                                    }}
                                />
                            </Box>
                        )}
                    </Box>

                    {/* Quick Action Controls */}
                    <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 0.5,
                                opacity: isMenuOpen ? 1 : 0,
                                transition: "opacity 0.2s ease",
                                ".course-card-container:hover &": {
                                    opacity: 1,
                                },
                            }}
                        >
                            {/* Add Sub-course */}
                            <Tooltip title="הוסף תת-מסלול">
                                <IconButton
                                    color="secondary"
                                    onClick={handleCreateSubCourse}
                                    size="small"
                                >
                                    <AddIcon className="text-[18px]" />
                                </IconButton>
                            </Tooltip>

                            {/* Quick-Assign Instructor */}
                            <Tooltip title="שייך מדריך">
                                <IconButton
                                    color="secondary"
                                    onClick={(e) =>
                                        setAnchorEl(e.currentTarget)
                                    }
                                    size="small"
                                >
                                    <PersonAddIcon className="text-[18px]" />
                                </IconButton>
                            </Tooltip>

                            {/* Delete Course */}
                            <Tooltip title="מחק מסלול">
                                <IconButton
                                    color="error"
                                    onClick={() => deleteCourse(course.id)}
                                    size="small"
                                >
                                    <DeleteIcon className="text-[16px]" />
                                </IconButton>
                            </Tooltip>
                        </Box>
                    </Box>
                </Box>

                {/* Assigned Instructors Chips List */}
                <Collapse
                    in={isExpanded ? assignedIds.length > 0 : false}
                    timeout="auto"
                    unmountOnExit
                >
                    <Box
                        sx={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 0.8,
                            mt: 1.5,
                            mr: 4, // Indent inside RTL card
                        }}
                    >
                        {assignedIds.map((id) => {
                            const inst = getInstructor(id);
                            if (!inst) return null;
                            return (
                                <Chip
                                    avatar={
                                        <HiveAvatar
                                            alt={inst.display_name ?? ""}
                                            hiveId={inst.id}
                                            sx={{
                                                bgcolor: "secondary.light",
                                                color: "secondary.contrastText",
                                                fontSize: "0.65rem",
                                                fontWeight: 800,
                                            }}
                                        />
                                    }
                                    key={id}
                                    label={inst.display_name}
                                    onDelete={() => handleRemoveInstructor(id)}
                                    size="small"
                                    sx={{
                                        fontSize: "0.72rem",
                                        fontWeight: 700,
                                        borderRadius: "8px",
                                        bgcolor: (theme) =>
                                            theme.palette.mode === "light"
                                                ? "#ffffff"
                                                : "rgba(255,255,255,0.06)",
                                        border: "1px solid",
                                        borderColor: "divider",
                                    }}
                                />
                            );
                        })}
                    </Box>
                </Collapse>
            </Box>

            {/* Recursively Render Sub-courses */}
            <Collapse
                in={isExpanded ? subCourses.length > 0 : false}
                timeout="auto"
                unmountOnExit
            >
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 1,
                        mr: 3.5, // Indentation for the children (in RTL margin-right indents)
                        borderRight: "1px dashed",
                        borderColor: "divider",
                        pr: 1.5, // Padding between the vertical line and the sub-courses
                        mt: 1,
                    }}
                >
                    {subCourses.map((child) => (
                        <CourseItem
                            allCourses={allCourses}
                            course={child}
                            depth={depth + 1}
                            key={child.id}
                            visited={nextVisited}
                        />
                    ))}
                </Box>
            </Collapse>

            {/* Inline Instructor Selection Menu */}
            <Menu
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
                open={isMenuOpen}
            >
                <MenuItem
                    disabled
                    sx={{ fontSize: "0.75rem", fontWeight: 700 }}
                >
                    בחר מדריך לשיוך
                </MenuItem>
                {unassignedInstructors.map((inst) => (
                    <MenuItem
                        key={inst.id}
                        onClick={() => handleAddInstructor(inst.id)}
                        sx={{
                            fontSize: "0.8rem",
                        }}
                    >
                        {inst.display_name}
                    </MenuItem>
                ))}
                {unassignedInstructors.length === 0 && (
                    <MenuItem disabled sx={{ fontSize: "0.8rem" }}>
                        כל המדריכים משוייכים
                    </MenuItem>
                )}
            </Menu>
        </Box>
    );
}
