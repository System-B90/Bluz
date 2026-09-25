import GroupsIcon from "@mui/icons-material/Groups";
import Chip from "@mui/material/Chip";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { MouseEvent } from "react";

import { normalizeShuffleName } from "@/api-shared/gantt/shuffle-names";
import { hiveClassUrl } from "@/api-shared/hive-links";
import { useActiveIterationHiveUrl } from "@/components/base/IterationProvider";
import { useHiveStudentGroups } from "@/components/gantt/use-hive-student-groups";

const styles = {
    chip: {
        flexShrink: 0,
        "& .MuiChip-icon": {
            marginInlineStart: 0.75,
            marginInlineEnd: -0.25,
        },
    },
} as const;

/**
 * A shuffle tag. Links to the same-named Hive student group when one exists;
 * the tooltip always carries the shuffle's description and says so when the
 * group is missing from Hive.
 */
export function ShuffleChip({
    name,
    description,
}: {
    name: string;
    description?: string;
}) {
    const hiveUrl = useActiveIterationHiveUrl();
    const groups = useHiveStudentGroups();
    const group = groups?.get(normalizeShuffleName(name));
    const href = group ? hiveClassUrl(Number(group.id), hiveUrl) : null;
    const missingFromHive = groups !== null && !group;

    const title = (
        <>
            <Typography variant="body2">{description?.trim() || "אין תיאור"}</Typography>
            {missingFromHive ? (
                <Typography color="warning.light" variant="caption">
                    שאפל לא קיים ב-Hive
                </Typography>
            ) : null}
        </>
    );

    return (
        <Tooltip title={title}>
            <Chip
                clickable={Boolean(href)}
                color={missingFromHive ? "warning" : "default"}
                component={href ? "a" : "div"}
                href={href ?? undefined}
                icon={<GroupsIcon />}
                label={name}
                onClick={href ? (e: MouseEvent) => e.stopPropagation() : undefined}
                rel="noopener noreferrer"
                size="small"
                sx={styles.chip}
                target="_blank"
                variant="outlined"
            />
        </Tooltip>
    );
}
