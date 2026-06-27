import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import React from "react";

import { GanttCurriculum } from "@/api-shared/types/gantt/models";

type CurriculumEntryProps = {
    curriculum: GanttCurriculum;
    onClick: () => void;
    selected: boolean;
};

// Visual distinction between Draft and Prod handled here
export const CurriculumEntry = React.memo(
    ({ curriculum, onClick, selected }: CurriculumEntryProps) => {
        const isDraft = curriculum?.isDraft;
        const isArchived = curriculum?.isArchived;

        const color = selected
            ? "text.action"
            : isArchived
                ? "text.disabled"
                : isDraft
                    ? "text.secondary"
                    : "text.primary";

        return (
            <ListItem disablePadding>
                <ListItemButton onClick={onClick}>
                    <ListItemText
                        primary={curriculum?.title || "ללא שם"}
                        slotProps={{
                            primary: {
                                sx: {
                                    color,
                                    fontWeight:
                                        !isDraft && !isArchived
                                            ? "medium"
                                            : "normal",
                                    fontStyle:
                                        isDraft || isArchived
                                            ? "italic"
                                            : "normal",
                                    textDecoration: isArchived
                                        ? "line-through"
                                        : "none",
                                    opacity: isArchived ? 0.7 : 1,
                                },
                            },
                        }}
                    />
                </ListItemButton>
            </ListItem>
        );
    },
);
CurriculumEntry.displayName = "CurriculumEntry";
