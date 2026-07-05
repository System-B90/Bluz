"use client";
import AddIcon from "@mui/icons-material/Add";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import RuleIcon from "@mui/icons-material/Rule";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useCallback, useMemo, useState } from "react";

import { CreateConstraintPayload } from "@/api-client/gantt/constraints";
import { GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";
import {
    ConstraintType,
    GanttConstraint,
    hasConflictingTemporalConstraints,
    RelationalConstraint,
} from "@/api-shared/types/gantt/models/constraint";
import { CollapsibleSection } from "@/components/gantt/event-dialog/CollapsibleSection";
import { buildVirtualSiblingConstraints } from "@/components/gantt/event-dialog/constraints/virtual-constraints";
import { ConstraintHumanReadableEntry } from "@/components/gantt/module-dialog/constraints/ConstraintHumanReadableEntry";
import { ConstraintListItem } from "@/components/gantt/module-dialog/constraints/ConstraintListItem";
import { DraftConstraintForm } from "@/components/gantt/module-dialog/constraints/DraftConstraintForm";
import { DraftConstraint } from "@/components/gantt/module-dialog/constraints/types";
import { useTargetOptions } from "@/components/gantt/module-dialog/constraints/use-target-options";
import { useGanttConstraints } from "@/components/gantt/state/constraints/hooks";
import { useCurriculumState } from "@/components/gantt/state/provider";

/**
 * A read-only constraint row used to surface the default sibling ordering
 * constraints. These are derived from the event's position in its module and
 * are never persisted — to change them the user re-orders the events.
 */
function VirtualConstraintItem({
    constraint,
}: {
    constraint: RelationalConstraint;
}) {
    return (
        <Tooltip title="אילוץ ברירת מחדל הנגזר מסדר המופעים. לשינוי יש לסדר מחדש את המופעים במערך.">
            <Box
                alignItems="center"
                bgcolor="action.hover"
                border={1}
                borderColor="divider"
                borderRadius={1}
                display="flex"
                gap={1}
                p={1}
                sx={{ opacity: 0.85 }}
            >
                <LockOutlinedIcon
                    fontSize="small"
                    sx={{ color: "text.disabled" }}
                />
                <ConstraintHumanReadableEntry constraint={constraint} />
            </Box>
        </Tooltip>
    );
}

export function EventConstraintsView({
    eventId,
    moduleId,
}: {
    eventId: GanttEventId;
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

    // The provider loads every constraint owned by the module's events; keep
    // only the ones this event owns.
    const constraintsList = useMemo(
        () =>
            Object.values(state.constraints).filter(
                (c) => c.ownerEventId === eventId,
            ),
        [state.constraints, eventId],
    );

    // Warning-only cross-constraint validation (#104): saving is not blocked.
    const hasTemporalConflict = useMemo(
        () => hasConflictingTemporalConstraints(constraintsList),
        [constraintsList],
    );

    // Default sibling constraints, derived from the event order in the module.
    const virtualConstraints = useMemo<Array<RelationalConstraint>>(() => {
        const ganttModule = curriculumState.modules[moduleId];
        if (!ganttModule) return [];
        return buildVirtualSiblingConstraints(eventId, moduleId, ganttModule.events);
    }, [curriculumState.modules, moduleId, eventId]);

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
                ownerType: "event",
                ownerEventId: eventId,
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
                ownerType: "event",
                ownerEventId: eventId,
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
    }, [draft, eventId, createConstraint]);

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

    // Collapsed-state summary: custom count, built-in count, conflict flag.
    const summaryChips = state.isLoading ? (
        <Chip label="טוען..." size="small" variant="outlined" />
    ) : (
        <>
            { hasTemporalConflict ? <Chip
                color="warning"
                icon={ <WarningAmberIcon /> }
                label="סתירה"
                size="small"
            /> : null }
            { constraintsList.length > 0 ? (
                <Chip
                    color="primary"
                    label={ `${constraintsList.length} אילוצים` }
                    size="small"
                    variant="outlined"
                />
            ) : (
                <Chip
                    label="ללא אילוצים"
                    size="small"
                    sx={ { color: "text.secondary" } }
                    variant="outlined"
                />
            ) }
            { virtualConstraints.length > 0 && (
                <Chip
                    label={ `${virtualConstraints.length} מובנים` }
                    size="small"
                    sx={ { color: "text.secondary" } }
                    variant="outlined"
                />
            ) }
        </>
    );

    return (
        <CollapsibleSection
            chips={ summaryChips }
            icon={ <RuleIcon /> }
            title="אילוצים"
        >
            {hasTemporalConflict ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    האילוצים הזמניים סותרים זה את זה — לא נותר אף יום
                    חוקי לשיבוץ. ניתן לשמור, אך מומלץ לתקן.
                </Alert>
            ) : null}

            {state.isLoading ? (
                <Stack spacing={1}>
                    <Skeleton height={52} variant="rounded" />
                    <Skeleton height={52} variant="rounded" />
                </Stack>
            ) : (
                <Stack spacing={1}>
                    {virtualConstraints.map((constraint) => (
                        <VirtualConstraintItem
                            constraint={constraint}
                            key={constraint.id}
                        />
                    ))}

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
                            לא הוגדרו אילוצים נוספים למופע זה.
                        </Typography>
                    )}

                    <Button
                        disabled={!!draft}
                        onClick={handleStartCreate}
                        size="small"
                        startIcon={<AddIcon />}
                        sx={{ alignSelf: "flex-start" }}
                    >
                        הוספת אילוץ
                    </Button>
                </Stack>
            )}
        </CollapsibleSection>
    );
}
