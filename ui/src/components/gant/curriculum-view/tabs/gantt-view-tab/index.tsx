'use client';
/**
 * Name: index.tsx (CurriculumGanttView)
 * Purpose: Main Gantt View tab for Bluz, integrating SVAR with Bluz state.
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */

import { Box, Paper, Typography } from '@mui/material';
import dayjs from 'dayjs';
import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';

import
    {
        Curriculum,
        CurriculumId,
        Module, ModuleEvent,
        Syllabus
    } from "@/api-shared/types/gant/curriculum";
import { CurriculumMappingProvider, useCurriculumMappings } from '@/components/gant/curriculum-view/tabs/builder-tab/components/CurriculumModuleDayMappingsProvider';
import { useCurriculum } from '@/components/gant/state/hooks/UseCurriculum';
import { useCurriculumState } from '@/components/gant/state/provider';

// SSR disabled to protect against SVAR browser-global dependencies
const GanttEngine = dynamic(() => import('./GanttEngine'), {
    ssr: false,
    loading: () => <Box sx={ { p: 4 } }>Loading Gantt...</Box>
});
interface GanttViewProps
{
    curriculum: Curriculum;
    syllabuses: Syllabus[];
    modules: Module[];
    events: ModuleEvent[];
}

/**
 * Logic to map the curriculum hierarchy and mappings into SVAR-compatible tasks
 */
const useGanttData = (props: GanttViewProps) =>
{
    const { state: { mappings } } = useCurriculumMappings();

    return useMemo(() =>
    {
        const tasks: any[] = [];
        const links: any[] = [];

        props.syllabuses.forEach(syllabus =>
        {
            const syllabusTaskId = `syllabus-${syllabus.id}`;
            tasks.push({
                id: syllabusTaskId,
                text: syllabus.title,
                type: "project",
                open: true,
            });

            syllabus.modules.forEach(mId =>
            {
                const module = props.modules.find(m => m.id === mId);
                if (!module) return;

                // Find all days this module is mapped to
                const moduleMappings = Object.values(mappings).filter(m => m.moduleId === mId);

                moduleMappings.forEach((mapping) =>
                {
                    // Start of curriculum is the anchor. 
                    // Adjust this dayjs logic if your curriculum has an explicit startDate.
                    const startDate = dayjs()
                        .startOf('week')
                        .add(mapping.weekIndex, 'week')
                        .add(mapping.dayIndex, 'day')
                        .toDate();

                    tasks.push({
                        id: `mapping-${mapping.moduleId}-${mapping.weekIndex}-${mapping.dayIndex}`,
                        parent: syllabusTaskId,
                        text: module.title,
                        start_date: startDate,
                        duration: 1,
                        type: "task",
                        moduleId: module.id,
                        origin: mapping // Keep original indices for the update callback
                    });
                });
            });
        });

        return { tasks, links };
    }, [ props.syllabuses, props.modules, mappings ]);
};
const CurriculumGanttViewInner = (props: any) =>
{
    const { moveModule } = useCurriculumMappings();
    const { tasks, links } = useGanttData(props); // Logic as defined in previous turns
    const [ scaleUnit, setScaleUnit ] = useState<"days" | "weeks">("weeks");

    const scales = useMemo(() => [
        { unit: scaleUnit, step: 1, format: scaleUnit === "days" ? "%d %M" : "Week %W" }
    ], [ scaleUnit ]);

    const handleDataUpdate = useCallback(({ action, obj }: any) =>
    {
        if (action !== "update" || !obj.moduleId) return;

        const newDate = dayjs(obj.start);
        const oldMapping = obj.origin;
        const anchor = dayjs().startOf('week');

        const nW = Math.floor(newDate.diff(anchor, 'week'));
        const nD = newDate.day();

        if (nW === oldMapping.weekIndex && nD === oldMapping.dayIndex) return;

        moveModule(obj.moduleId, { w: oldMapping.weekIndex, d: oldMapping.dayIndex }, { w: nW, d: nD });
    }, [ moveModule ]);

    return (
        <Paper variant="outlined" sx={ { flexGrow: 1, overflow: 'hidden' } }>
            <GanttEngine
                tasks={ tasks }
                links={ links }
                scales={ scales }
                onDataUpdate={ handleDataUpdate }
            />
        </Paper>
    );
};

const MetricItem = ({ label, value }: { label: string, value: string; }) => (
    <Box>
        <Typography variant="caption" color="text.secondary" sx={ { textTransform: 'uppercase', letterSpacing: 1 } }>
            { label }
        </Typography>
        <Typography variant="h5">{ value }</Typography>
    </Box>
);

export function CurriculumGanttView({ curriculumId }: { curriculumId: CurriculumId; })
{
    const curriculum = useCurriculum(curriculumId);
    const state = useCurriculumState();

    const innerProps = useMemo(() => curriculum ? ({
        curriculum,
        syllabuses: Object.values(state.syllabuses),
        modules: Object.values(state.modules),
        events: Object.values(state.events),
    }) : null, [ curriculum, state ]);

    if (!innerProps) return null;

    return (
        <CurriculumMappingProvider curriculumId={ curriculumId }>
            <CurriculumGanttViewInner { ...innerProps } />
        </CurriculumMappingProvider>
    );
}