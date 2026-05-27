import DeleteIcon from "@mui/icons-material/Delete";
import { Box, IconButton } from "@mui/material";

import { ConstraintHumanReadableEntry } from "@/components/gantt/module-dialog/constraints/ConstraintHumanReadableEntry";

import { GanttConstraint } from "@/api-shared/types/gantt/models/constraint";

export function ConstraintListItem({
    constraint,
    onRemove,
}: {
    constraint: GanttConstraint;
    onRemove: (id: string) => void;
})
{
    return (
        <Box
            alignItems="center"
            border={ 1 }
            borderColor="divider"
            borderRadius={ 1 }
            display="flex"
            justifyContent="space-between"
            p={ 1 }
        >
            <ConstraintHumanReadableEntry constraint={ constraint } />
            <IconButton
                color="error"
                onClick={ () => onRemove(constraint.id) }
                size="small"
            >
                <DeleteIcon fontSize="small" />
            </IconButton>
        </Box>
    );
}
