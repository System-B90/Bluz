'use client';
/**
 * Name: GanttEngine.tsx
 * Purpose: Officially documented SVAR Gantt integration for Next.js.
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */

import { Gantt } from "@svar-ui/react-gantt";
import '@svar-ui/react-gantt/all.css';
interface GanttEngineProps
{
    tasks: any[];
    links: any[];
    scales: any[];
    onDataUpdate: (event: any) => void;
}

export default function GanttEngine({ tasks, links, scales, onDataUpdate }: GanttEngineProps)
{
    console.log('tasks', tasks);
    return (
        <div className="wx-willow-theme" style={ { width: "100%", height: "100%" } }>
            <Gantt
                tasks={ tasks }
                onDataUpdate={ onDataUpdate }
            />
        </div>
    );
}