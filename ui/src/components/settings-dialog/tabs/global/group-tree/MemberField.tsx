import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import { Box, Chip, Paper, Stack, Tooltip, Typography } from "@mui/material";

import { userColors } from "@/components/schedule/types/types";
import { User } from "@/components/schedule/types/user";

interface GroupMemberFieldProps {
  user: User;
}

export function GroupMemberField({ user }: GroupMemberFieldProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: user.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: "grab",
  };

  return (
    <Paper ref={setNodeRef} {...attributes} {...listeners} style={style}>
      <Stack alignItems="center" direction="row" spacing={2} sx={{ p: 1 }}>
        <Box {...listeners} {...attributes} sx={{ cursor: "grab" }}>
          <DragIndicatorIcon />
        </Box>
        <Typography>{user.name}</Typography>
        <Tooltip title={user.type}>
          <Chip
            label={user.type}
            size="small"
            sx={{ backgroundColor: userColors[user.type], color: "#000" }}
          />
        </Tooltip>
      </Stack>
    </Paper>
  );
}
