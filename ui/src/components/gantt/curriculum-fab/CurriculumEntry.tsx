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

        return (
            <ListItem disablePadding>
                <ListItemButton onClick={onClick}>
                    <ListItemText
                        primary={curriculum?.title || "ללא שם"}
                        slotProps={{
                            primary: {
                                sx: {
                                    color: selected
                                        ? "text.action"
                                        : isDraft
                                            ? "text.secondary"
                                            : "text.primary",
                                    fontWeight: isDraft ? "normal" : "medium",
                                    fontStyle: isDraft ? "italic" : "normal",
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
