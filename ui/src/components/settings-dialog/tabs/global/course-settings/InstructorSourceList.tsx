import { useDraggable } from "@dnd-kit/core";
import SearchIcon from "@mui/icons-material/Search";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import InputAdornment from "@mui/material/InputAdornment";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";

import { CourseUser } from "@/api-shared/types/hive";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { HiveAvatar } from "@/components/header/HiveAvatarImage";
import { DraggedInstructorData } from "@/components/settings-dialog/tabs/global/course-settings/dnd-types";

export function InstructorCard({
    instructor,
    isOverlay = false,
}: {
    instructor: CourseUser;
    isOverlay?: boolean;
})
{
    return (
        <Card
            sx={ (theme) => ({
                p: 1.2,
                display: "flex",
                alignItems: "center",
                gap: 1.2,
                borderRadius: "10px",
                border: "1px solid",
                borderColor: isOverlay ? "secondary.main" : "divider",
                boxShadow: isOverlay
                    ? "0 8px 24px rgba(0, 0, 0, 0.15)"
                    : "none",
                bgcolor: "background.paper",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                cursor: isOverlay ? "grabbing" : "grab",
                "&:hover": {
                    borderColor: "secondary.main",
                    bgcolor: "action.hover",
                    transform: isOverlay ? "none" : "translateY(-1px)",
                    boxShadow: isOverlay
                        ? undefined
                        : `0 4px 12px rgb(${theme.vars.palette.primary.mainChannel} / 0.1)`,
                },
                ...theme.applyStyles("dark", {
                    bgcolor: "rgba(255, 255, 255, 0.03)",
                    "&:hover": {
                        boxShadow: isOverlay
                            ? undefined
                            : "0 4px 12px rgba(0, 0, 0, 0.25)",
                    },
                }),
            }) }
        >
            <HiveAvatar
                alt={ instructor.display_name ?? "" }
                hiveId={ instructor.id }
                sx={ {
                    bgcolor: "secondary.light",
                    color: "secondary.contrastText",
                    width: 26,
                    height: 26,
                    fontSize: "0.75rem",
                    fontWeight: 700,
                } }
            />
            <Typography
                sx={ {
                    fontWeight: 700,
                    fontSize: "0.8rem",
                    color: "text.primary",
                    userSelect: "none",
                } }
            >
                { instructor.display_name }
            </Typography>
        </Card>
    );
}

function DraggableInstructorItem({ instructor }: { instructor: CourseUser; })
{
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: `instructor-${instructor.id}`,
        data: {
            type: "INSTRUCTOR",
            instructorId: instructor.id,
        } as DraggedInstructorData,
    });

    return (
        <Box
            ref={ setNodeRef }
            { ...listeners }
            { ...attributes }
            sx={ {
                opacity: isDragging ? 0.4 : 1,
                touchAction: "none",
            } }
        >
            <InstructorCard instructor={ instructor } />
        </Box>
    );
}

export function InstructorSourceList()
{
    const { instructors } = useHiveUsers();
    const [ search, setSearch ] = useState("");

    const filtered = useMemo(() =>
    {
        const query = search.trim().toLowerCase();
        if (!query) return instructors;
        return instructors.filter((instructor) =>
            instructor.display_name.toLowerCase().includes(query),
        );
    }, [ instructors, search ]);

    return (
        <Box
            sx={ (theme) => ({
                width: 220,
                borderLeft: "1px solid",
                borderColor: "divider",
                p: 2,
                display: "flex",
                flexDirection: "column",
                gap: 2,
                height: "100%",
                boxSizing: "border-box",
                bgcolor: "rgba(103, 200, 221, 0.02)",
                ...theme.applyStyles("dark", { bgcolor: "rgba(255, 255, 255, 0.01)" }),
            }) }
        >
            <Box>
                <Typography
                    sx={ {
                        fontWeight: 800,
                        fontSize: "0.95rem",
                        color: "text.primary",
                        mb: 0.5,
                    } }
                >
                    מדריכים זמינים
                </Typography>
                <Typography
                    sx={ {
                        fontSize: "0.72rem",
                        color: "text.secondary",
                    } }
                >
                    גרור מדריך לתוך מסלול כדי לשייכו
                </Typography>
            </Box>

            <TextField
                onChange={ (e) => setSearch(e.target.value) }
                placeholder="חיפוש מדריך..."
                size="small"
                slotProps={ {
                    input: {
                        startAdornment: (
                            <InputAdornment position="start">
                                <SearchIcon
                                    sx={ { fontSize: 16, color: "text.secondary" } }
                                />
                            </InputAdornment>
                        ),
                        sx: {
                            borderRadius: "10px",
                            fontSize: "0.8rem",
                            bgcolor: "background.paper",
                        },
                    },
                } }
                value={ search }
                variant="outlined"
            />

            <Box
                sx={ {
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    overflowY: "auto",
                    flexGrow: 1,
                    pr: 0.5,
                    pt: 1,
                    mt: -1,
                } }
            >
                { filtered.map((inst) => (
                    <DraggableInstructorItem instructor={ inst } key={ inst.id } />
                )) }
                { filtered.length === 0 && (
                    <Typography
                        align="center"
                        sx={ {
                            color: "text.secondary",
                            fontSize: "0.78rem",
                            mt: 4,
                        } }
                    >
                        לא נמצאו מדריכים
                    </Typography>
                ) }
            </Box>
        </Box>
    );
}
