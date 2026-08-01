"use client";
import AddIcon from "@mui/icons-material/Add";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import RuleIcon from "@mui/icons-material/Rule";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import { useMemo } from "react";

import { GanttEventId, GanttModuleId } from "@/api-shared/types/gantt/models";
import { RelationalConstraint } from "@/api-shared/types/gantt/models/constraint";
import { CollapsibleSection } from "@/components/gantt/event-dialog/CollapsibleSection";
import { buildVirtualSiblingConstraints } from "@/components/gantt/event-dialog/constraints/virtual-constraints";
import { ConstraintHumanReadableEntry } from "@/components/gantt/module-dialog/constraints/ConstraintHumanReadableEntry";
import {
    ConstraintRows,
    TEMPORAL_CONFLICT_MESSAGE,
} from "@/components/gantt/module-dialog/constraints/ConstraintRows";
import { useConstraintEditor } from "@/components/gantt/module-dialog/constraints/use-constraint-editor";
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
    const curriculumState = useCurriculumState();
    const editor = useConstraintEditor("event", eventId);

    // Default sibling constraints, derived from the event order in the module.
    const virtualConstraints = useMemo<Array<RelationalConstraint>>(() => {
        const ganttModule = curriculumState.modules[moduleId];
        if (!ganttModule) return [];
        return buildVirtualSiblingConstraints(eventId, moduleId, ganttModule.events);
    }, [curriculumState.modules, moduleId, eventId]);

    // Collapsed-state summary: custom count, built-in count, conflict flag.
    const summaryChips = editor.isLoading ? (
        <Chip label="טוען..." size="small" variant="outlined" />
    ) : (
        <>
            { editor.hasTemporalConflict ? <Chip
                color="warning"
                icon={ <WarningAmberIcon /> }
                label="סתירה"
                size="small"
            /> : null }
            { editor.constraints.length > 0 ? (
                <Chip
                    color="primary"
                    label={ `${editor.constraints.length} אילוצים` }
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
            {editor.hasTemporalConflict ? (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    {TEMPORAL_CONFLICT_MESSAGE}
                </Alert>
            ) : null}

            <ConstraintRows
                editor={editor}
                emptyText="לא הוגדרו אילוצים נוספים למופע זה."
                prefix={virtualConstraints.map((constraint) => (
                    <VirtualConstraintItem
                        constraint={constraint}
                        key={constraint.id}
                    />
                ))}
            />

            {editor.isLoading ? null : (
                <Button
                    disabled={!!editor.draft}
                    onClick={editor.startCreate}
                    size="small"
                    startIcon={<AddIcon />}
                    sx={{ alignSelf: "flex-start", mt: 1 }}
                >
                    הוספת אילוץ
                </Button>
            )}
        </CollapsibleSection>
    );
}
