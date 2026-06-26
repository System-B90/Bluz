"use client";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useCallback, useMemo, useState } from "react";

import { CreateConstraintPayload } from "@/api-client/gantt/constraints";
import { GanttModuleId } from "@/api-shared/types/gantt/models";
import {
    ConstraintType,
    GanttConstraint,
} from "@/api-shared/types/gantt/models/constraint";
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
    const { state, removeConstraint, createConstraint, updateConstraint } =
        useGanttConstraints();

    const [draft, setDraft] = useState<DraftConstraint | null>(null);
    const [editingConstraintId, setEditingConstraintId] = useState<
        null | string
    >(null);
    const [editingDraft, setEditingDraft] = useState<DraftConstraint | null>(
        null,
    );

    const constraintsList = useMemo(
        () => Object.values(state.constraints),
        [state.constraints],
    );

    const handleStartCreate = useCallback(() => {
        setDraft({
            type: ConstraintType.Relational,
            targetId: "",
            targetType: "",
            relation: "after",
            minDelay: "",
            maxDelay: "",
        });
    }, []);

    const handleCancelCreate = useCallback(() => {
        setDraft(null);
    }, []);

    const handleSubmitCreate = useCallback(async () => {
        if (!draft) return;

        let payload: Omit<CreateConstraintPayload, "id">;

        if (draft.type === ConstraintType.Relational) {
            payload = {
                type: ConstraintType.Relational,
                ownerType: "module",
                ownerModuleId: moduleId,
                // @ts-ignore: TS doesn't narrow correctly
                targetId: draft.targetId,
                targetType: draft.targetType as "event" | "module",
                relation: draft.relation,
                minDelayDays: draft.minDelay
                    ? Number(draft.minDelay)
                    : undefined,
                maxDelayDays: draft.maxDelay
                    ? Number(draft.maxDelay)
                    : undefined,
            };
        } else {
            payload = {
                type: ConstraintType.Temporal,
                ownerType: "module",
                ownerModuleId: moduleId,
                // @ts-ignore: TS doesn't narrow correctly
                allowedDays: draft.allowedDays
                    ? Array.isArray(draft.allowedDays)
                        ? draft.allowedDays
                        : String(draft.allowedDays)
                            .split(",")
                            .map((d: string) => Number(d.trim()))
                    : undefined,
                forbiddenDays: draft.forbiddenDays
                    ? Array.isArray(draft.forbiddenDays)
                        ? draft.forbiddenDays
                        : String(draft.forbiddenDays)
                            .split(",")
                            .map((d: string) => Number(d.trim()))
                    : undefined,
            };
        }

        await createConstraint(payload);
        setDraft(null);
    }, [draft, moduleId, createConstraint]);

    const handleStartEdit = useCallback((constraint: GanttConstraint) => {
        setEditingConstraintId(constraint.id);
        if (constraint.type === ConstraintType.Relational) {
            setEditingDraft({
                type: ConstraintType.Relational,
                targetId: constraint.targetId,
                targetType: constraint.targetType,
                relation: constraint.relation,
                minDelay:
                    constraint.minDelayDays !== undefined
                        ? String(constraint.minDelayDays)
                        : "",
                maxDelay:
                    constraint.maxDelayDays !== undefined
                        ? String(constraint.maxDelayDays)
                        : "",
            });
        } else {
            setEditingDraft({
                type: ConstraintType.Temporal,
                allowedDays: constraint.allowedDays ?? [],
                forbiddenDays: constraint.forbiddenDays ?? [],
            });
        }
    }, []);

    const handleCancelEdit = useCallback(() => {
        setEditingConstraintId(null);
        setEditingDraft(null);
    }, []);

    const handleSubmitEdit = useCallback(async () => {
        if (!editingConstraintId || !editingDraft) return;

        let payload: Partial<CreateConstraintPayload>;

        if (editingDraft.type === ConstraintType.Relational) {
            payload = {
                type: ConstraintType.Relational,
                targetId: editingDraft.targetId,
                targetType: editingDraft.targetType as "event" | "module",
                relation: editingDraft.relation,
                minDelayDays: editingDraft.minDelay
                    ? Number(editingDraft.minDelay)
                    : undefined,
                maxDelayDays: editingDraft.maxDelay
                    ? Number(editingDraft.maxDelay)
                    : undefined,
            };
        } else {
            payload = {
                type: ConstraintType.Temporal,
                allowedDays: editingDraft.allowedDays
                    ? Array.isArray(editingDraft.allowedDays)
                        ? editingDraft.allowedDays
                        : String(editingDraft.allowedDays)
                            .split(",")
                            .map((d: string) => Number(d.trim()))
                    : undefined,
                forbiddenDays: editingDraft.forbiddenDays
                    ? Array.isArray(editingDraft.forbiddenDays)
                        ? editingDraft.forbiddenDays
                        : String(editingDraft.forbiddenDays)
                            .split(",")
                            .map((d: string) => Number(d.trim()))
                    : undefined,
            };
        }

        await updateConstraint(editingConstraintId, payload);
        setEditingConstraintId(null);
        setEditingDraft(null);
    }, [editingConstraintId, editingDraft, updateConstraint]);

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
                    <Stack spacing={1}>
                        <Skeleton height={52} variant="rounded" />
                        <Skeleton height={52} variant="rounded" />
                    </Stack>
                ) : (
                    <Stack spacing={1}>
                        {constraintsList.map((constraint) => {
                            const isEditing =
                                constraint.id === editingConstraintId;
                            if (isEditing && editingDraft) {
                                return (
                                    <DraftConstraintForm
                                        curriculumState={curriculumState}
                                        draft={editingDraft}
                                        key={constraint.id}
                                        onCancel={handleCancelEdit}
                                        onSubmit={handleSubmitEdit}
                                        setDraft={setEditingDraft}
                                        targetOptions={targetOptions}
                                    />
                                );
                            }
                            return (
                                <ConstraintListItem
                                    constraint={constraint}
                                    key={constraint.id}
                                    onEdit={() => handleStartEdit(constraint)}
                                    onRemove={removeConstraint}
                                />
                            );
                        })}

                        {draft ? (
                            <DraftConstraintForm
                                curriculumState={curriculumState}
                                draft={draft}
                                onCancel={handleCancelCreate}
                                onSubmit={handleSubmitCreate}
                                setDraft={setDraft}
                                targetOptions={targetOptions}
                            />
                        ) : null}

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
