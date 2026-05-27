import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { Box, IconButton, InputBase, Tooltip, Typography } from "@mui/material";
import {
    MuiColorInput,
    MuiColorInputColors,
    MuiColorInputProps,
} from "mui-color-input";
import { useCallback, useState } from "react";

import { Course } from "@/api-shared/types/course";

export function CourseItem({
    course,
    onUpdate,
    onDelete,
}: {
  course: Course;
  onUpdate: (id: string, name?: string, color?: string | null) => void;
  onDelete: (id: string) => void;
}) {
    const [title, setTitle] = useState<string>(course.name);
    const [color, setColor] = useState<string>(course.color ?? "#e0e0e0");
    const [isEditing, setIsEditing] = useState<boolean>(false);

    const commitTitleChange = useCallback(() => {
        setIsEditing(false);
        const trimmed = title.trim();
        if (trimmed && trimmed !== course.name) {
            // Instantly auto-saves name change
            onUpdate(course.id, trimmed, undefined);
        } else {
            setTitle(course.name);
        }
    }, [title, course.name, course.id, onUpdate]);

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
            // Instantly auto-saves color change
            onUpdate(course.id, undefined, hex);
        },
        [course.id, onUpdate],
    );

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.5,
                p: "6px 14px",
                borderRadius: "20px",
                border: "1px solid",
                borderColor: "divider",
                bgcolor: (theme) =>
                    theme.palette.mode === "light"
                        ? "rgba(103, 200, 221, 0.04)"
                        : "rgba(255, 255, 255, 0.02)",
                transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                position: "relative",
                overflow: "hidden",
                "& .delete-btn": {
                    opacity: 0,
                    transform: "scale(0.8) translateX(8px)",
                    transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
                    width: 0,
                    p: 0,
                },
                "&:hover": {
                    borderColor: "primary.main",
                    boxShadow: "0 4px 12px rgba(103, 200, 221, 0.08)",
                    bgcolor: "action.hover",
                    "& .delete-btn": {
                        opacity: 1,
                        transform: "scale(1) translateX(0)",
                        width: "28px",
                        p: "4px",
                    },
                },
            }}
        >
            {/* Color Input Dot (Styled Color Circle Hack) */}
            <Box sx={{ display: "flex", alignItems: "center" }}>
                <MuiColorInput
                    dir="ltr"
                    format="hex"
                    fullWidth={false}
                    isAlphaHidden
                    onChange={handleColorChange}
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
                            "& .MuiOutlinedInput-notchedOutline": { border: "none" },
                            "& input": { display: "none" },
                            "& .MuiInputAdornment-root": { m: 0, width: "100%", height: "100%" },
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
                    display: "flex",
                    alignItems: "center",
                    gap: 0.8,
                    cursor: "pointer",
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
                            fontFamily: "Assistant, sans-serif",
                            width: `${Math.max(title.length, 6)}ch`,
                            borderBottom: "1px solid",
                            borderColor: "primary.main",
                        }}
                        value={title}
                    />
                ) : (
                    <Box display="flex" alignItems="center" gap={0.5} sx={{ "&:hover svg": { opacity: 1 } }}>
                        <Typography
                            sx={{
                                fontWeight: 700,
                                fontSize: "0.88rem",
                                fontFamily: "Assistant, sans-serif",
                                userSelect: "none",
                                color: "text.primary",
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
                            }}
                        />
                    </Box>
                )}
            </Box>

            {/* Hover-to-Reveal Delete Action */}
            <Tooltip title="מחק מסלול">
                <IconButton
                    className="delete-btn"
                    color="error"
                    onClick={() => onDelete(course.id)}
                    size="small"
                >
                    <DeleteIcon sx={{ fontSize: 16 }} />
                </IconButton>
            </Tooltip>
        </Box>
    );
}

