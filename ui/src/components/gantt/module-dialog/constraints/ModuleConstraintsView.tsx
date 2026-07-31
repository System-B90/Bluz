"use client";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";

import { GanttModuleId } from "@/api-shared/types/gantt/models";
import {
    ConstraintRows,
    TEMPORAL_CONFLICT_MESSAGE,
} from "@/components/gantt/module-dialog/constraints/ConstraintRows";
import { useConstraintEditor } from "@/components/gantt/module-dialog/constraints/use-constraint-editor";

export function ModuleConstraintsView({
    moduleId,
}: {
    moduleId: GanttModuleId;
}) {
    const editor = useConstraintEditor("module", moduleId);

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack
                    alignItems="center"
                    direction="row"
                    justifyContent="space-between"
                    mb={2}
                >
                    <Typography variant="h6">אילוצים</Typography>
                    <Button
                        color="primary"
                        disabled={!!editor.draft}
                        onClick={editor.startCreate}
                        size="small"
                        variant="outlined"
                    >
                        הוספת אילוץ
                    </Button>
                </Stack>

                {editor.hasTemporalConflict ? (
                    <Alert severity="warning" sx={{ mb: 2 }}>
                        {TEMPORAL_CONFLICT_MESSAGE}
                    </Alert>
                ) : null}

                <ConstraintRows
                    editor={editor}
                    emptyText="לא הוגדרו אילוצים למערך זה."
                />
            </CardContent>
        </Card>
    );
}
