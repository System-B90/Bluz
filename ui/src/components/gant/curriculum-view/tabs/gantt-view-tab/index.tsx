/**
 * Name: CurriculumGanttView.tsx
 * Purpose: SVAR Gantt implementation for Bluz curriculum management.
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */

import { Box, Divider, Paper, Stack, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import { Gantt, Willow } from "@svar/re-gantt";
import dayjs from 'dayjs';
import React, { useMemo } from 'react';

import
    {
        Curriculum,
        Module, ModuleEvent,
        Syllabus
    } from "@/api-shared/types/gant/curriculum";
import { useCurriculumMappings } from '@/components/gant/curriculum-view/tabs/builder-tab/components/CurriculumModuleDayMappingsProvider';

interface GanttViewProps
{
    curriculum: Curriculum;
    syllabuses: Syllabus[];
    modules: Module[];
    events: ModuleEvent[];
}

/**
 * Helper to map Bluz hierarchy to SVAR flat task list
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
            // 1) Syllabuses as folders
            tasks.push({
                id: `syllabus-${syllabus.id}`,
                text: syllabus.title,
                type: "project",
                open: true,
            });

            syllabus.modules.forEach(mId =>
            {
                const module = props.modules.find(m => m.id === mId);
                if (!module) return;

                // Find mappings for this module to determine dates
                const moduleMappings = Object.values(mappings).filter(m => m.moduleId === mId);

                moduleMappings.forEach((mapping, index) =>
                {
                    // Logic: Map week/day index to actual date
                    // Note: Base date is assumed as the start of curriculum (Week 0, Day 0)
                    const startDate = dayjs().startOf('week')
                        .add(mapping.weekIndex, 'week')
                        .add(mapping.dayIndex, 'day')
                        .toDate();

                    tasks.push({
                        id: `mapping-${mapping.moduleId}-${mapping.weekIndex}-${mapping.dayIndex}`,
                        parent: `syllabus-${syllabus.id}`,
                        text: module.title,
                        start_date: startDate,
                        duration: 1, // Granularity is Days
                        type: "task",
                        moduleId: module.id, // Custom prop for moveModule
                        origin: mapping
                    });
                });
            });
        });

        return { tasks, links };
    }, [ props, mappings ]);
};

export const CurriculumGanttView: React.FC<GanttViewProps> = (props) =>
{
    const { moveModule } = useCurriculumMappings();
    const { tasks, links } = useGanttData(props);
    const [ scale, setScale ] = React.useState<"days" | "weeks">("weeks");

    const handleDataUpdate = ({ action, obj, id }: any) =>
    {
        if (action === "update" && obj.moduleId)
        {
            const newDate = dayjs(obj.start_date);
            const oldMapping = obj.origin;

            const to = {
                w: Math.floor(newDate.diff(dayjs(obj.start_date).startOf('year'), 'week')), // Placeholder logic for date->index
                d: newDate.day()
            };

            moveModule(obj.moduleId, { w: oldMapping.weekIndex, d: oldMapping.dayIndex }, to);
        }
    };

    return (
        <Stack direction="row" spacing={ 1 } sx={ { height: '100%', width: '100%' } }>
            {/* Main Gantt Area */ }
            <Box sx={ { flexGrow: 1, display: 'flex', flexDirection: 'column' } }>
                <Box sx={ { p: 1, display: 'flex', justifyContent: 'flex-end' } }>
                    <ToggleButtonGroup
                        value={ scale }
                        exclusive
                        onChange={ (_, v) => v && setScale(v) }
                        size="small"
                    >
                        <ToggleButton value="days">Days</ToggleButton>
                        <ToggleButton value="weeks">Weeks</ToggleButton>
                    </ToggleButtonGroup>
                </Box>

                <Paper variant="outlined" sx={ { flexGrow: 1, overflow: 'hidden' } }>
                    <Willow>
                        <Gantt
                            tasks={ tasks }
                            links={ links }
                            scales={ [
                                { unit: scale, step: 1, format: scale === "days" ? "DD MMM" : "Week %W" }
                            ] }
                            onDataUpdate={ handleDataUpdate }
                            columns={ [
                                { name: "text", label: "Module Name", width: 200, tree: true },
                                { name: "duration", label: "Days", width: 60 }
                            ] }
                        />
                    </Willow>
                </Paper>
            </Box>

            {/* Bluz Stats Sidebar */ }
            <Paper sx={ { width: 300, p: 2, height: '100%' } } elevation={ 0 }>
                <Typography variant="h6" gutterBottom>Curriculum Metrics</Typography>
                <Divider sx={ { mb: 2 } } />
                <Stack spacing={ 2 }>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Total Weeks</Typography>
                        <Typography variant="body1">{ props.curriculum.weeks.length }</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Total Allocated Hours</Typography>
                        <Typography variant="body1">
                            {/* Calculation logic for used vs total */ }
                            { props.events.reduce((acc, curr) => acc + (curr.allocatedDuration / 60), 0).toFixed(1) } hrs
                        </Typography>
                    </Box>
                </Stack>
            </Paper>
        </Stack>
    );
};