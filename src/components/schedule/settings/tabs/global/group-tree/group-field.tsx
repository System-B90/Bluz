import {Group} from "@/components/schedule/types/group";
import {Box, Chip, Stack, Tooltip, Typography} from "@mui/material";
import React from "react";
import {groupColors} from "@/components/schedule/types/types";
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {DraggableAttributes} from "@dnd-kit/core";
import {SyntheticListenerMap} from "@dnd-kit/core/dist/hooks/utilities";

interface GroupFieldProps {
    group: Group;
    attributes: DraggableAttributes;
    listeners?: SyntheticListenerMap;
}

export default function GroupField({group, attributes, listeners}: GroupFieldProps) {

    return (
        <Stack direction="row" spacing={2} alignItems="center" sx={{width: '100%'}}>
            {/* Drag handle */}
            <Box {...listeners} {...attributes} sx={{cursor: 'grab'}}>
                <DragIndicatorIcon/>
            </Box>

            {/* Group name and type */}
            <Typography variant="subtitle1">{group.name}</Typography>
            <Tooltip title={group.groupType}>
                <Chip
                    label={group.groupType}
                    size="small"
                    sx={{backgroundColor: groupColors[group.groupType], color: '#fff'}}
                />
            </Tooltip>
        </Stack>

    )
}