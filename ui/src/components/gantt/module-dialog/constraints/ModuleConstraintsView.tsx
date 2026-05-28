"use client";

import {
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    Stack,
    Typography,
} from "@mui/material";
import { useMemo, useState } from "react";

import { CreateConstraintPayload } from "@/api-client/gantt/constraints";
import { GanttModuleId } from "@/api-shared/types/gantt/models";
import { ConstraintType } from "@/api-shared/types/gantt/models/constraint";
import { ConstraintListItem } from "@/components/gantt/module-dialog/constraints/ConstraintListItem";
import { DraftConstraintForm } from "@/components/gantt/module-dialog/constraints/DraftConstraintForm";
import { DraftConstraint } from "@/components/gantt/module-dialog/constraints/types";
import { useTargetOptions } from "@/components/gantt/module-dialog/constraints/use-target-options";
import { useGanttConstraints } from "@/components/gantt/state/constraints/hooks";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function ModuleConstraintsView({
    moduleId,
}: {
    moduleId: GanttModuleId;
}) {
    const targetOptions = useTargetOptions();
    const curriculumState = useCurriculumState();
    const { state, removeConstraint, createConstraint } = useGanttConstraints();

    const [draft, setDraft] = useState<DraftConstraint | null>(null);

    const constraintsList = useMemo(
        () => Object.values(state.constraints),
        [state.constraints]
    );

    const handleStartCreate = () => {
        setDraft({
            type: ConstraintType.Relational,
            targetId: "",
            targetType: "",
            relation: "after",
            minDelay: "",
            maxDelay: "",
        });
    };

    const handleCancelCreate = () => {
        setDraft(null);
    };

    const handleSubmitCreate = async () => {
        if (!draft) return;

        let payload: Omit<CreateConstraintPayload, 'id'>;

        if (draft.type === ConstraintType.Relational) {
            payload = {
                type: ConstraintType.Relational,
                ownerType: "module",
                ownerModuleId: moduleId,
                // @ts-ignore: TS doesn't narrow correctly
                targetId: draft.targetId,
                targetType: draft.targetType as "event" | "module",
                relation: draft.relation,
                minDelayDays: draft.minDelay ? Number(draft.minDelay) : undefined,
                maxDelayDays: draft.maxDelay ? Number(draft.maxDelay) : undefined,
            };
        } else {
            payload = {
                type: ConstraintType.Temporal,
                ownerType: "module",
                ownerModuleId: moduleId,
                // @ts-ignore: TS doesn't narrow correctly
                allowedDays: draft.allowedDays
                    ? (Array.isArray(draft.allowedDays) ? draft.allowedDays : String(draft.allowedDays).split(",").map((d: string) => Number(d.trim())))
                    : undefined,
                forbiddenDays: draft.forbiddenDays
                    ? (Array.isArray(draft.forbiddenDays) ? draft.forbiddenDays : String(draft.forbiddenDays).split(",").map((d: string) => Number(d.trim())))
                    : undefined,
            };
        }

        await createConstraint(payload);
        setDraft(null);
    };

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
                        disabled={!!draft}
                        onClick={handleStartCreate}
                        size="small"
                        variant="outlined"
                    >
                        הוספת אילוץ
                    </Button>
                </Stack>

                {state.isLoading ? (
                    <Box display="flex" justifyContent="center" p={2}>
                        <CircularProgress size={24} />
                    </Box>
                ) : (
                    <Stack spacing={1}>
                        {constraintsList.map((constraint) => (
                            <ConstraintListItem
                                constraint={constraint}
                                key={constraint.id}
                                onRemove={removeConstraint}
                            />
                        ))}

                        {draft ? <DraftConstraintForm
                            curriculumState={curriculumState}
                            draft={draft}
                            onCancel={handleCancelCreate}
                            onSubmit={handleSubmitCreate}
                            setDraft={setDraft}
                            targetOptions={targetOptions}
                        /> : null}

                        {constraintsList.length === 0 && !draft && (
                            <Typography color="text.secondary" variant="body2">
                                לא הוגדרו אילוצים למערך זה.
                            </Typography>
                        )}
                    </Stack>
                )}
            </CardContent>
        </Card>
    );
}
