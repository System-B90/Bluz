"use client";
import { useCallback, useMemo, useState } from "react";

import { CreateConstraintPayload } from "@/api-client/gantt/constraints";
import { GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";
import {
    ConstraintType,
    GanttConstraint,
    hasConflictingTemporalConstraints,
} from "@/api-shared/types/gantt/models/constraint";
import { DraftConstraint } from "@/components/gantt/module-dialog/constraints/types";
import { useGanttConstraints } from "@/components/gantt/state/constraints/hooks";

/** Identifies whose constraints are being edited — a module or a single event. */
export type ConstraintOwnerType = "event" | "module";

/** Accepts either the array form or a legacy comma-separated string. */
function toDayList(
    value: Array<number> | string | undefined,
): Array<number> | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) return value;
    return value
        .split(",")
        .map((day: string) => Number(day.trim()));
}

/** The persisted fields of a draft, without any owner identity. */
function draftToPayload(draft: DraftConstraint): Partial<CreateConstraintPayload> {
    if (draft.type === ConstraintType.Relational) {
        return {
            type: ConstraintType.Relational,
            targetId: draft.targetId,
            targetType: draft.targetType as "event" | "module",
            relation: draft.relation,
            minDelayDays: draft.minDelay ? Number(draft.minDelay) : undefined,
            maxDelayDays: draft.maxDelay ? Number(draft.maxDelay) : undefined,
        } as Partial<CreateConstraintPayload>;
    }
    return {
        type: ConstraintType.Temporal,
        allowedDays: toDayList(draft.allowedDays),
        forbiddenDays: toDayList(draft.forbiddenDays),
    } as Partial<CreateConstraintPayload>;
}

/** A blank relational draft — the starting point for "add constraint". */
function emptyDraft(): DraftConstraint {
    return {
        type: ConstraintType.Relational,
        targetId: "",
        targetType: "",
        relation: "after",
        minDelay: "",
        maxDelay: "",
    };
}

/** Reverse of {@link draftToPayload}: seeds the edit form from a saved row. */
function constraintToDraft(constraint: GanttConstraint): DraftConstraint {
    if (constraint.type === ConstraintType.Relational) {
        return {
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
        };
    }
    return {
        type: ConstraintType.Temporal,
        allowedDays: constraint.allowedDays ?? [],
        forbiddenDays: constraint.forbiddenDays ?? [],
    };
}

/**
 * Create/edit/remove state machine shared by the module- and event-level
 * constraint panels. The only difference between the two is the owner fields
 * stamped onto the create payload and which constraints are listed.
 */
export function useConstraintEditor(
    ownerType: ConstraintOwnerType,
    ownerId: GanttEventId | GanttModuleId,
) {
    const { state, removeConstraint, createConstraint, updateConstraint } =
        useGanttConstraints();

    const [draft, setDraft] = useState<DraftConstraint | null>(null);
    const [editingConstraintId, setEditingConstraintId] = useState<
        null | string
    >(null);
    const [editingDraft, setEditingDraft] = useState<DraftConstraint | null>(
        null,
    );

    // The provider loads every constraint owned by the module's events; an
    // event-level panel keeps only the ones that event owns.
    const constraints = useMemo(() => {
        const all = Object.values(state.constraints);
        return ownerType === "event"
            ? all.filter((c) => c.ownerEventId === ownerId)
            : all;
    }, [state.constraints, ownerType, ownerId]);

    // Warning-only cross-constraint validation (#104): saving is not blocked.
    const hasTemporalConflict = useMemo(
        () => hasConflictingTemporalConstraints(constraints),
        [constraints],
    );

    const startCreate = useCallback(() => setDraft(emptyDraft()), []);
    const cancelCreate = useCallback(() => setDraft(null), []);

    const submitCreate = useCallback(async () => {
        if (!draft) return;
        await createConstraint({
            ...draftToPayload(draft),
            ownerType,
            ...(ownerType === "event"
                ? { ownerEventId: ownerId as GanttEventId }
                : { ownerModuleId: ownerId as GanttModuleId }),
        } as Omit<CreateConstraintPayload, "id">);
        setDraft(null);
    }, [draft, ownerType, ownerId, createConstraint]);

    const startEdit = useCallback((constraint: GanttConstraint) => {
        setEditingConstraintId(constraint.id);
        setEditingDraft(constraintToDraft(constraint));
    }, []);

    const cancelEdit = useCallback(() => {
        setEditingConstraintId(null);
        setEditingDraft(null);
    }, []);

    const submitEdit = useCallback(async () => {
        if (!editingConstraintId || !editingDraft) return;
        await updateConstraint(editingConstraintId, draftToPayload(editingDraft));
        setEditingConstraintId(null);
        setEditingDraft(null);
    }, [editingConstraintId, editingDraft, updateConstraint]);

    return {
        constraints,
        hasTemporalConflict,
        isLoading: state.isLoading,
        draft,
        setDraft,
        startCreate,
        cancelCreate,
        submitCreate,
        editingConstraintId,
        editingDraft,
        setEditingDraft,
        startEdit,
        cancelEdit,
        submitEdit,
        removeConstraint,
    };
}

export type ConstraintEditor = ReturnType<typeof useConstraintEditor>;
