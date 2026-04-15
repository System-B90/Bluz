/**
 * Name: SyllabusModulesCurriculumViewSidebar.tsx
 * Purpose: Professional sidebar with sticky headers, alphabetical syllabus sorting, and module ordering.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import
    {
        CurriculumId
    } from "@/api-shared/types/gant/curriculum";
import { SyllabusSection } from "@/components/gant/curriculum-view/tabs/builder-tab/components/syllabus-modules/SyllabusSection";
import
    {
        useCurriculum
    } from "@/components/gant/state/hooks";
import { useSyllabusNames } from "@/components/gant/state/providers/SyllabusNamesProvider";
import
    {
        Box,
        BoxProps,
        Divider
    } from "@mui/material";
import React, { useMemo } from "react";

export interface SidebarProps extends BoxProps
{
    curriculumId: CurriculumId | null;
}

export default function SyllabusModulesCurriculumViewSidebar({
    curriculumId,
    ...props
}: SidebarProps)
{
    const { syllabusNames } = useSyllabusNames();
    const curriculum = useCurriculum(curriculumId ?? '');
    const syllabuses = curriculum?.syllabuses;

    const sortedSyllabusIds = useMemo(() =>
    {
        return [ ...(syllabuses ?? []) ].sort((a, b) =>
        {
            return syllabusNames[ a ].localeCompare(syllabusNames[ b ]);
        });
    }, [ syllabuses, syllabusNames ]);

    return (
        <Box
            { ...props }
            className="flex flex-col h-full overflow-x-clip shrink-0 border-r border-slate-200 bg-slate-50/30"
            sx={ { width: 320, ...props.sx } }
        >
            <Box className="grow overflow-y-auto overflow-x-clip scroll-smooth">
                { sortedSyllabusIds.map((s, idx) => (
                    <React.Fragment key={ s }>
                        <SyllabusSection syllabusId={ s } />
                        { idx !== sortedSyllabusIds.length - 1 && (
                            <Divider className="mx-4 opacity-60" />
                        ) }
                    </React.Fragment>
                )) }
            </Box>
        </Box>
    );
}
