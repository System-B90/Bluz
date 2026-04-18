// Lot's of Gemini code in this file, quality may be inconsistent. Please review carefully.
import DeleteIcon from "@mui/icons-material/Delete";
import { Box, Chip, InputBase, Tooltip, Typography } from "@mui/material";
import {
  MuiColorInput,
  MuiColorInputColors,
  MuiColorInputProps,
} from "mui-color-input";
import { useCallback, useState } from "react";

import { Color } from "@/api-shared/common";
import { Course } from "@/api-shared/types/course";

export function CourseItem({
  course,
  onUpdate,
  onDelete,
}: {
  course: Course;
  onUpdate: (
    id: string,
    { newName, newColor }: { newName?: string; newColor?: Color | null },
  ) => void;
  onDelete: (id: string) => void;
}) {
  const [title, setTitle] = useState<string>(course.name);
  const [color, setColor] = useState<Color | null>(course.color);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const commitTitleChange = useCallback(() => {
    setIsEditing(false);
    if (title.trim() && title !== course.name) {
      onUpdate(course.id, { newName: title.trim() });
    } else {
      setTitle(course.name);
    }
  }, [title, course.name, course.id, onUpdate]);

  const commitColorChange = useCallback(
    (newColor: Color) => {
      if (newColor !== course.color) {
        onUpdate(course.id, { newColor });
      }
      // No need to manually reset state here; if the update fails or changes,
      // the parent will eventually trigger a remount if the key changes.
    },
    [course.color, course.id, onUpdate],
  );

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
    (_value: string, colors: MuiColorInputColors) => {
      const hex = colors.hex as Color;
      setColor(hex);
      commitColorChange(hex);
    },
    [commitColorChange],
  );

  return (
    <Chip
      deleteIcon={
        <Tooltip title="מחק מסלול">
          <DeleteIcon />
        </Tooltip>
      }
      label={
        <Box
          alignItems={"center"}
          display={"flex"}
          flexDirection={"row"}
          gap={0.5}
        >
          <MuiColorInput
            dir="ltr"
            format="hex"
            fullWidth={false}
            isAlphaHidden
            onChange={handleColorChange}
            size={"small"}
            sx={{
              p: 0,
              m: 0,
              width: "1rem",
              height: "1rem",
              "& .MuiInputBase-root": {
                padding: 0,
                "& .MuiOutlinedInput-notchedOutline": { border: "none" },
              },
            }}
            value={color ?? "#e0e0e0"}
          />
          {isEditing ? (
            <InputBase
              autoFocus
              onBlur={commitTitleChange}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
              sx={{
                fontSize: "inherit",
                width: `${Math.max(title.length, 5)}ch`,
              }}
              value={title}
            />
          ) : (
            <Typography
              onDoubleClick={() => setIsEditing(true)}
              sx={{ cursor: "pointer", userSelect: "none" }}
            >
              {title}
            </Typography>
          )}
        </Box>
      }
      onDelete={() => onDelete(course.id)}
      size="small"
    />
  );
}
