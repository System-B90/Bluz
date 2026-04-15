/**
 * Name: SyllabusModulesCurriculumViewSidebar.tsx
 * Purpose: Professional sidebar with sticky headers, alphabetical syllabus sorting, and module ordering.
 * Created: 2026-04-15
 * Author: Michael K. Steinberg
 */

import
    {
        CurriculumId,
        ModuleId,
        SyllabusId
    } from "@/api-shared/types/gant/curriculum";
import
    {
        useCurriculum,
        useModule,
        useSyllabus
    } from "@/components/gant/state/hooks";
import { useSyllabusNames } from "@/components/gant/state/providers/SyllabusNamesProvider";
import { useDraggable } from "@dnd-kit/core";
import
    {
        Box,
        BoxProps,
        Divider,
        Paper,
        PaperProps,
        Stack,
        Typography
    } from "@mui/material";
import React, { useMemo } from "react";

export interface ModuleItemProps extends PaperProps
{
    moduleId: ModuleId;
}

export interface SyllabusSectionProps extends BoxProps
{
    syllabusId: SyllabusId;
}

export interface SidebarProps extends BoxProps
{
    curriculumId: CurriculumId | null;
}

function ModuleItem({ moduleId, ...props }: ModuleItemProps)
{
    const module = useModule(moduleId);

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `module-${moduleId}`,
        data: { type: 'MODULE', moduleId }
    });

    const style = transform ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    } : undefined;

    return (
        <Paper
            ref={ setNodeRef }
            style={ style }
            elevation={ isDragging ? 4 : 0 }
            { ...attributes }
            { ...listeners }
            { ...props }
            className={ `
                p-2 border border-solid border-slate-200 cursor-grab 
                hover:border-blue-400 hover:bg-blue-50 transition-colors
                active:cursor-grabbing z-10
                ${isDragging ? 'opacity-50' : 'opacity-100'}
            `}
        >
            <Typography variant="body2" className="select-none font-medium text-slate-700">
                { module?.title ?? 'Unknown Module' }
            </Typography>
        </Paper>
    );
}

function SyllabusSection({ syllabusId, ...props }: SyllabusSectionProps)
{
    const syllabus = useSyllabus(syllabusId);

    const moduleItems = useMemo(() =>
        (syllabus?.modules ?? []).map((m) => (
            <ModuleItem key={ m } moduleId={ m } />
        )),
        [ syllabus?.modules ]);

    return (
        <Box { ...props } className="flex flex-col pb-4">
            {/* Sticky Header: Visible until the entire section scrolls out */ }
            <Box className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm py-3 mb-2 shadow-sm">
                <Typography
                    variant="overline"
                    className="px-2 font-bold tracking-wider"
                    color="primary"
                >
                    { syllabus?.title ?? 'Unnamed Syllabus' }
                </Typography>
            </Box>

            <Stack spacing={ 1 } className="px-2">
                { moduleItems }
            </Stack>
        </Box>
    );
}

export default function SyllabusModulesCurriculumViewSidebar({
    curriculumId,
    ...props
}: SidebarProps)
{
    const { syllabusNames } = useSyllabusNames();
    const curriculum = useCurriculum(curriculumId ?? '');
    const syllabuses = curriculum?.syllabuses ?? [];

    const sortedSyllabusIds = useMemo(() =>
    {
        return [ ...syllabuses ].sort((a, b) =>
        {
            return syllabusNames[ a ].localeCompare(syllabusNames[ b ]);
        });
    }, [ syllabuses, syllabusNames ]);

    return (
        <Box
            { ...props }
            className="flex flex-col h-full overflow-hidden shrink-0 border-r border-slate-200 bg-slate-50/30"
            sx={ { width: 320, ...props.sx } }
        >
            <Box className="grow overflow-y-auto scroll-smooth">
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
