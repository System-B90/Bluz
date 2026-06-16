/**
 * Name: SyllabusModulesCurriculumViewSidebar.tsx
 * Purpose: Professional sidebar with sticky headers, alphabetical syllabus sorting, and module ordering.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import { useDroppable } from "@dnd-kit/core";
import Box, { BoxProps } from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import { alpha, useTheme } from "@mui/material/styles";
import React, { useMemo } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { DndDragEventOverData } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/dnd-types";
import { SyllabusSection } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/syllabus-modules/SyllabusSection";
import { useCurriculum } from "@/components/gantt/state/hooks/UseCurriculum";
import { useSyllabusNames } from "@/components/gantt/state/providers/SyllabusNamesProvider";

export type SidebarProps = {
    curriculumId: GanttCurriculumId | null;
} & BoxProps;

export function SyllabusModulesCurriculumViewSidebar({
    curriculumId,
    ...props
}: SidebarProps) {
    const theme = useTheme();
    const { syllabusNames } = useSyllabusNames();
    const curriculum = useCurriculum(curriculumId ?? "");
    const syllabuses = curriculum?.syllabuses;

    const sortedSyllabusIds = useMemo(() => {
        return [...(syllabuses ?? [])].sort((a, b) => {
            return (syllabusNames[a] ?? "").localeCompare(
                syllabusNames[b] ?? "",
            );
        });
    }, [syllabuses, syllabusNames]);

    const dropId = `sidebar`;

    const { isOver, setNodeRef } = useDroppable({
        id: dropId,
        data: {
            type: "SIDEBAR",
        } as DndDragEventOverData,
    });

    // Memoize the rendered sections to optimize performance during drag operations
    const renderedSyllabusSections = useMemo(() => {
        return sortedSyllabusIds.map((s, idx) => (
            <React.Fragment key={s}>
                <SyllabusSection syllabusId={s} />
                {idx !== sortedSyllabusIds.length - 1 && (
                    <Divider className="mx-4 opacity-60" />
                )}
            </React.Fragment>
        ));
    }, [sortedSyllabusIds]);

    return (
        <Box
            {...props}
            className="flex flex-col h-full overflow-x-clip shrink-0 border-r border-slate-200"
            ref={setNodeRef}
            sx={{
                width: 320,
                backgroundColor: isOver
                    ? alpha(theme.palette.error.main, 0.08)
                    : "transparent",
                transition: theme.transitions.create(
                    ["background-color", "transform"],
                    {
                        duration: theme.transitions.duration.shorter,
                    },
                ),
                transform: isOver ? "scale(1.01)" : "scale(1)",
                zIndex: isOver ? 1 : "auto",
                ...props.sx,
            }}
        >
            <Box className="grow overflow-y-auto overflow-x-clip scroll-smooth bg-slate-50/30 pl-1">
                {renderedSyllabusSections}
            </Box>
        </Box>
    );
}
