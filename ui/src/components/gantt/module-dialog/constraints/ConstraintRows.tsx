"use client";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { ReactNode } from "react";

import { ConstraintListItem } from "@/components/gantt/module-dialog/constraints/ConstraintListItem";
import { DraftConstraintForm } from "@/components/gantt/module-dialog/constraints/DraftConstraintForm";
import { ConstraintEditor } from "@/components/gantt/module-dialog/constraints/use-constraint-editor";
import { useTargetOptions } from "@/components/gantt/module-dialog/constraints/use-target-options";
import { useCurriculumState } from "@/components/gantt/state/provider";

export type ConstraintRowsProps = {
    editor: ConstraintEditor;
    /** Shown when there are no saved constraints and no open draft. */
    emptyText: string;
    /** Read-only rows rendered above the editable ones (e.g. virtual ones). */
    prefix?: ReactNode;
};

/**
 * The constraint list body shared by the module and event panels: loading
 * skeletons, one row per constraint (swapped for the edit form while editing),
 * the create draft form, and the empty-state text.
 */
export function ConstraintRows({
    editor,
    emptyText,
    prefix,
}: ConstraintRowsProps) {
    const targetOptions = useTargetOptions();
    const curriculumState = useCurriculumState();

    if (editor.isLoading) {
        return (
            <Stack spacing={1}>
                <Skeleton height={52} variant="rounded" />
                <Skeleton height={52} variant="rounded" />
            </Stack>
        );
    }

    return (
        <Stack spacing={1}>
            {prefix}

            {editor.constraints.map((constraint) => {
                const isEditing = constraint.id === editor.editingConstraintId;
                if (isEditing && editor.editingDraft) {
                    return (
                        <DraftConstraintForm
                            curriculumState={curriculumState}
                            draft={editor.editingDraft}
                            key={constraint.id}
                            onCancel={editor.cancelEdit}
                            onSubmit={editor.submitEdit}
                            setDraft={editor.setEditingDraft}
                            targetOptions={targetOptions}
                        />
                    );
                }
                return (
                    <ConstraintListItem
                        constraint={constraint}
                        key={constraint.id}
                        onEdit={() => editor.startEdit(constraint)}
                        onRemove={editor.removeConstraint}
                    />
                );
            })}

            {editor.draft ? (
                <DraftConstraintForm
                    curriculumState={curriculumState}
                    draft={editor.draft}
                    onCancel={editor.cancelCreate}
                    onSubmit={editor.submitCreate}
                    setDraft={editor.setDraft}
                    targetOptions={targetOptions}
                />
            ) : null}

            {editor.constraints.length === 0 && !editor.draft && (
                <Typography color="text.secondary" variant="body2">
                    {emptyText}
                </Typography>
            )}
        </Stack>
    );
}

/** Shared warning text for mutually exclusive temporal constraints (#104). */
export const TEMPORAL_CONFLICT_MESSAGE =
    "האילוצים הזמניים סותרים זה את זה — לא נותר אף יום חוקי לשיבוץ. ניתן לשמור, אך מומלץ לתקן.";
