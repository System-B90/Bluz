/**
 * Name: SyllabusScopeSummary.tsx
 * Purpose: Under a syllabus row's name on the timeline: which courses
 *   (מסלולים) it serves and which shuffles (שאפלים) split its students, so
 *   cross-shuffle rules can be checked where the planning happens (#830).
 * Created: 2026-10-03
 * Author: Michael K. Steinberg
 */
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import GroupsIcon from "@mui/icons-material/Groups";
import Box from "@mui/material/Box";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";

import { CourseId } from "@/api-shared/types/course";
import { useCourses } from "@/components/base/CoursesProvider";

type SyllabusScopeSummaryProps = {
    courseIds?: Array<CourseId> | null;
    shuffles?: Array<string> | null;
};

const ITEM_SX = {
    display: "inline-flex",
    alignItems: "center",
    gap: 0.25,
    minWidth: 0,
    "& .MuiSvgIcon-root": { fontSize: 14, flexShrink: 0 },
} as const;

/** "שאפל אחד" / "3 שאפלים". */
export function shuffleCountLabel(count: number): string
{
    return count === 1 ? "שאפל אחד" : `${count} שאפלים`;
}

export const SyllabusScopeSummary: React.FC<SyllabusScopeSummaryProps> = ({
    courseIds,
    shuffles,
}) =>
{
    const { getCourse } = useCourses();
    const courseNames = (courseIds ?? []).map((id) => getCourse(id)?.name ?? "מסלול שנמחק");
    const shuffleNames = shuffles ?? [];
    if (courseNames.length === 0 && shuffleNames.length === 0) return null;

    return (
        <Box
            data-testid="syllabus-scope"
            sx={ {
                display: "flex",
                alignItems: "center",
                gap: 1,
                color: "text.secondary",
                paddingInlineStart: 3.5,
                minWidth: 0,
            } }
        >
            { courseNames.length > 0 ? (
                <Tooltip title={ `מסלולים: ${courseNames.join(", ")}` }>
                    <Box aria-label={ `מסלולים: ${courseNames.join(", ")}` } role="img" sx={ ITEM_SX }>
                        <AccountTreeIcon aria-hidden />
                        <Typography noWrap variant="caption">{ courseNames.join(", ") }</Typography>
                    </Box>
                </Tooltip>
            ) : null }
            { shuffleNames.length > 0 ? (
                <Tooltip title={ `שאפלים: ${shuffleNames.join(", ")}` }>
                    <Box aria-label={ `שאפלים: ${shuffleNames.join(", ")}` } role="img" sx={ { ...ITEM_SX, flexShrink: 0 } }>
                        <GroupsIcon aria-hidden />
                        <Typography noWrap variant="caption">{ shuffleCountLabel(shuffleNames.length) }</Typography>
                    </Box>
                </Tooltip>
            ) : null }
        </Box>
    );
};
