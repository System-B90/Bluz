'use client';
/**
 * Name: GanttEngine.tsx
 * Purpose: Stabilized SVAR Gantt engine for Bluz curriculum management.
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */

import { Gantt, Willow } from "@svar-ui/react-gantt";
import React from 'react';

interface GanttEngineProps
{
    tasks: any[];
    links: any[];
    scale: 'days' | 'weeks';
    onDataUpdate: (event: { action: string; obj: any; id: string | number; }) => void;
}

const GanttEngine: React.FC<GanttEngineProps> = ({ tasks, links, scale, onDataUpdate }) =>
{
    return (
        <div className="wx-willow-theme">
            <Willow />
            <Gantt
                tasks={ tasks }
                links={ links }
                scales={ [
                    {
                        unit: scale,
                        step: 1,
                        format: scale === "days" ? "DD MMM" : "Week %W"
                    }
                ] }
                onDataUpdate={ onDataUpdate }
                columns={ [
                    { name: "text", label: "Module Name", width: 250, tree: true },
                    { name: "duration", label: "Days", width: 70 }
                ] }
            />
        </div>
    );
};

export default GanttEngine;