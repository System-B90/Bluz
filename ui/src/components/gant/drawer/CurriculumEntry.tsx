import { Curriculum } from "@/api-shared/types/gant/curriculum";
import { ListItem, ListItemButton, ListItemText } from "@mui/material";
import React from "react";

interface CurriculumEntryProps
{
    curriculum: Curriculum;
    onClick: () => void;
    selected: boolean;
}

// Visual distinction between Draft and Prod handled here
export const CurriculumEntry = React.memo(({ curriculum, onClick, selected }: CurriculumEntryProps) =>
{
    const isDraft = curriculum?.draft;

    return (
        <ListItem disablePadding>
            <ListItemButton onClick={ onClick }>
                <ListItemText
                    primary={ curriculum?.title || "ללא שם" }
                    slotProps={ {
                        primary: {
                            sx: {
                                color: selected ? 'text.action' : (isDraft ? 'text.secondary' : 'text.primary'),
                                fontWeight: isDraft ? 'normal' : 'medium',
                                fontStyle: isDraft ? 'italic' : 'normal'
                            }
                        }
                    } }
                />
            </ListItemButton>
        </ListItem>
    );
});
CurriculumEntry.displayName = 'CurriculumEntry';
