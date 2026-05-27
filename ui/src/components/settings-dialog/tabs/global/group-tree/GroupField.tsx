import { DraggableAttributes } from "@dnd-kit/core";
import { SyntheticListenerMap } from "@dnd-kit/core/dist/hooks/utilities";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { Box, Chip, Stack, Tooltip, Typography } from "@mui/material";

import { Group } from "@/components/schedule/types/group";
import { groupColors } from "@/components/schedule/types/types";

type GroupFieldProps = {
  group: Group;
  attributes: DraggableAttributes;
  listeners?: SyntheticListenerMap;
};

export function GroupField({ group, attributes, listeners }: GroupFieldProps) {
    return (
        <Stack
            alignItems="center"
            direction="row"
            spacing={2}
            sx={{ width: "100%" }}
        >
            {/* Drag handle */}
            <Box {...listeners} {...attributes} sx={{ cursor: "grab" }}>
                <DragIndicatorIcon />
            </Box>

            {/* Group name and type */}
            <Typography variant="subtitle1">{group.name}</Typography>
            <Tooltip title={group.groupType}>
                <Chip
                    label={group.groupType}
                    size="small"
                    sx={{ backgroundColor: groupColors[group.groupType], color: "#fff" }}
                />
            </Tooltip>
        </Stack>
    );
}
