/**
 * Name: GanttEngine.tsx
 * Purpose: SVAR Gantt component wrapper with proper typing.
 * Created: 2026-04-17
 * Author: Michael K. Steinberg
 */

'use client';
import '@svar-ui/react-gantt/all.css';
//

import { Gantt, Willow } from '@svar-ui/react-gantt';
import React from 'react';

import { GanttEngineProps } from '@/components/gantt/curriculum-view/tabs/gantt-view-tab/types';

/**
 * GanttEngine Component
 */
export function GanttEngine({
    tasks,
    links,
    scales,
    onDataUpdate
}: GanttEngineProps): React.ReactElement
{
    const _scaleArray = scales && scales.length > 0 ? scales : [ { unit: 'weeks' as const, step: 1 } ];

    return (
        <div className="wx-willow-theme" style={ { width: '100%', height: '100%' } }>
            <Willow />
            <Gantt
                links={ links }
                // scales={ scaleArray }
                onDataUpdate={ onDataUpdate }
                tasks={ tasks }
            />
        </div>
    );
}
