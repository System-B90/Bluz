import { useMemo } from "react";

import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { GanttEvent, GanttModule } from "@/api-shared/types/gantt/models";
import {
    ConstraintType,
    GanttConstraint,
    hasConflictingTemporalConstraints,
} from "@/api-shared/types/gantt/models/constraint";
import { ConstraintLink } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";

// Flags constraint violations (temporal + relational) for the constraints
// overlay/indicators, and builds the relational-constraint link list for
// ConstraintLines (#104).
export const useGanttViolations = ({
    constraints,
    days,
    eventMappings,
    events,
    linearDays,
    moduleMappings,
    modules,
}: {
    constraints: Record<string, GanttConstraint>;
    days: NormalizedStore["days"];
    eventMappings: Record<string, string>;
    events: Record<string, GanttEvent>;
    linearDays: Array<string>;
    moduleMappings: Record<string, Array<string>>;
    modules: Record<string, GanttModule>;
}) => useMemo(() =>
{
    const v: Record<string, Array<string>> = {};
    const links: Array<ConstraintLink> = [];

    const getMappedDayIdx = (type: "event" | "module", id: string) =>
    {
        if (type === "event")
        {
            const dayId = eventMappings[ id ];
            return dayId ? linearDays.indexOf(dayId) : -1;
        } else
        {
            const dayIds = moduleMappings[ id ] || [];
            const indices = dayIds
                .map((d) => linearDays.indexOf(d))
                .filter((i) => i !== -1);
            return indices.length ? Math.min(...indices) : -1;
        }
    };

    const processConstraints = (
        entity: { constraints?: Array<GanttConstraint> },
        entityId: string,
        entityType: "event" | "module",
    ) =>
    {
        const cIds: Array<string> = (entity.constraints || []).map(
            (c) => c.id,
        );

        // Conflicting temporal constraints are flagged even before the
        // entity is mapped to a day (#104). Warning only — never blocks.
        if (
            hasConflictingTemporalConstraints(
                cIds.map((cId) => constraints[ cId ]),
            )
        )
        {
            if (!v[ entityId ]) v[ entityId ] = [];
            v[ entityId ].push("אילוצים סותרים: לא נותר אף יום חוקי");
        }

        const myIdx = getMappedDayIdx(entityType, entityId);
        if (myIdx === -1) return;

        const myDay = days[ linearDays[ myIdx ] ];
        if (!myDay) return;

        cIds.forEach((cId) =>
        {
            const c = constraints[ cId ];
            if (!c) return;

            if (c.type === ConstraintType.Temporal)
            {
                if (
                    c.allowedDays &&
                    !c.allowedDays.includes(myDay.dayIndex)
                )
                {
                    if (!v[ entityId ]) v[ entityId ] = [];
                    v[ entityId ].push("מפר ימי עבודה מותרים");
                }
                if (
                    c.forbiddenDays &&
                    c.forbiddenDays.includes(myDay.dayIndex)
                )
                {
                    if (!v[ entityId ]) v[ entityId ] = [];
                    v[ entityId ].push("מפר ימי עבודה אסורים");
                }
            } else if (c.type === ConstraintType.Relational)
            {
                const targetIdx = getMappedDayIdx(c.targetType, c.targetId);
                if (targetIdx === -1) return;

                let isViolated = false;
                // Mirrors the solver (cut-constraints.ts applyRelational):
                // delta is positive when on the constraint's expected side.
                const delta =
                    c.relation === "after"
                        ? myIdx - targetIdx
                        : targetIdx - myIdx;

                if (delta <= 0) isViolated = true;
                // Server rows carry `null` (not `undefined`) when unset;
                // `delta > null` would compare against 0.
                if (c.minDelayDays != null && delta < c.minDelayDays)
                    isViolated = true;
                if (c.maxDelayDays != null && delta > c.maxDelayDays)
                    isViolated = true;

                if (isViolated)
                {
                    if (!v[ entityId ]) v[ entityId ] = [];
                    v[ entityId ].push(
                        `מפר אילוץ יחסי עם ${c.targetType === "event" ? "מפגש" : "מערך"}`,
                    );
                }

                links.push({
                    id: `${entityId}-${c.targetId}`,
                    sourceId: `block-${entityType}-${entityId}`,
                    targetId: `block-${c.targetType}-${c.targetId}`,
                    isViolated,
                });
            }
        });
    };

    Object.values(modules).forEach((m) =>
        processConstraints(m, m.id, "module"),
    );
    Object.values(events).forEach((e) =>
        processConstraints(e, e.id, "event"),
    );

    return { violations: v, activeLinks: links };
}, [ modules, events, constraints, moduleMappings, eventMappings, linearDays, days ]);
