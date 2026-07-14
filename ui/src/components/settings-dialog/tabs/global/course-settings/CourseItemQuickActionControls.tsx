import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import { Course } from "@/api-shared/types/course";

export type CourseItemQuickActionControlsProps = {
    course: Course;
    isHovered: boolean;
    isMenuOpen: boolean;
    setAnchorEl: React.Dispatch<React.SetStateAction<HTMLElement | null>>;
    handleCreateSubCourse: () => void;
    deleteCourse: (courseId: string) => void;
};

export function CourseItemQuickActionControls({
    course,
    isHovered,
    isMenuOpen,
    setAnchorEl,
    handleCreateSubCourse,
    deleteCourse
}: CourseItemQuickActionControlsProps)
{
    return (
        <Collapse in={ isHovered || isMenuOpen } orientation="horizontal">
            <Box
                sx={ { display: "flex", alignItems: "center", gap: 0.5 } }
            >
                <Box
                    sx={ {
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        transition: "opacity 0.2s ease",
                    } }
                >
                    {/* Add Sub-course */ }
                    <Tooltip title="הוספת תת-מסלול">
                        <IconButton
                            color="secondary"
                            onClick={ handleCreateSubCourse }
                            size="small"
                        >
                            <AddIcon className="text-[18px]" />
                        </IconButton>
                    </Tooltip>

                    {/* Quick-Assign Instructor */ }
                    <Tooltip title="שיוך מדריך">
                        <IconButton
                            color="secondary"
                            onClick={ (e) =>
                                setAnchorEl(e.currentTarget)
                            }
                            size="small"
                        >
                            <PersonAddIcon className="text-[18px]" />
                        </IconButton>
                    </Tooltip>

                    {/* Delete Course */ }
                    <Tooltip title="מחיקת מסלול">
                        <IconButton
                            color="error"
                            onClick={ () => deleteCourse(course.id) }
                            size="small"
                        >
                            <DeleteIcon className="text-[16px]" />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Box>
        </Collapse>
    );
}
