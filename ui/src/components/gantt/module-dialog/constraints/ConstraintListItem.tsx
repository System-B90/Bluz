import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";

import { GanttConstraint } from "@/api-shared/types/gantt/models/constraint";
import { ConstraintHumanReadableEntry } from "@/components/gantt/module-dialog/constraints/ConstraintHumanReadableEntry";

export function ConstraintListItem({
    constraint,
    onEdit,
    onRemove,
}: {
  constraint: GanttConstraint;
  onEdit: () => void;
  onRemove: (id: string) => void;
}) {
    return (
        <Box
            alignItems="center"
            border={1}
            borderColor="divider"
            borderRadius={1}
            display="flex"
            justifyContent="space-between"
            p={1}
            sx={{
                transition: "all 0.2s ease-in-out",
                "&:hover": {
                    bgcolor: "action.hover",
                    borderColor: "primary.main",
                },
            }}
        >
            <ConstraintHumanReadableEntry constraint={constraint} />
            <Stack direction="row" spacing={0.5}>
                <IconButton
                    color="error"
                    onClick={() => onRemove(constraint.id)}
                    size="small"
                >
                    <DeleteIcon fontSize="small" />
                </IconButton>
                <IconButton color="primary" onClick={onEdit} size="small">
                    <EditIcon fontSize="small" />
                </IconButton>
            </Stack>
        </Box>
    );
}
