import DeleteIcon from "@mui/icons-material/Delete";
import { Box, Button, Card, CardContent, CircularProgress, IconButton, Stack, Typography } from "@mui/material";
import { useContext, useMemo } from "react";

import { GanttModuleId } from "@/api-shared/types/gantt/models";
import { GanttConstraintContext } from "@/components/gantt/state/constraints/context";

export function ModuleConstraintsView({ moduleId }: { moduleId: GanttModuleId; })
{
    const context = useContext(GanttConstraintContext);

    if (!context)
    {
        return null;
    }

    const { state, removeConstraint } = context;

    const constraintsList = useMemo(
        () => Object.values(state.constraints),
        [ state.constraints ]
    );

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack alignItems="center" direction="row" justifyContent="space-between" mb={ 2 }>
                    <Typography variant="h6">אילוצים</Typography>
                    <Button color="primary" size="small" variant="outlined">
                        הוספת אילוץ
                    </Button>
                </Stack>

                { state.isLoading ? (
                    <Box display="flex" justifyContent="center" p={ 2 }>
                        <CircularProgress size={ 24 } />
                    </Box>
                ) : constraintsList.length === 0 ? (
                    <Typography color="text.secondary" variant="body2">
                        לא הוגדרו אילוצים למערך זה.
                    </Typography>
                ) : (
                    <Stack spacing={ 1 }>
                        { constraintsList.map((constraint) => (
                            <Box
                                key={ constraint.id }
                                alignItems="center"
                                border={ 1 }
                                borderColor="divider"
                                borderRadius={ 1 }
                                display="flex"
                                justifyContent="space-between"
                                p={ 1 }
                            >
                                <Stack>
                                    <Typography variant="body2" fontWeight="bold">
                                        { constraint.type === "RELATIONAL" ? "אילוץ יחסי" : "אילוץ זמן" }
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        {/* Placeholder for specific constraint string formatter */ }
                                        { constraint.id }
                                    </Typography>
                                </Stack>
                                <IconButton
                                    color="error"
                                    onClick={ () => removeConstraint(constraint.id) }
                                    size="small"
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        )) }
                    </Stack>
                ) }
            </CardContent>
        </Card>
    );
}