import { useTheme } from '@mui/material';
import React, { useCallback, useEffect, useState } from 'react';
import { ConstraintLink } from './types';

interface ConstraintLinesProps
{
    links: ConstraintLink[];
    containerRef: React.RefObject<HTMLDivElement | null>;
}

export const ConstraintLines: React.FC<ConstraintLinesProps> = ({ links, containerRef }) =>
{
    const theme = useTheme();
    const [ lines, setLines ] = useState<any[]>([]);

    const drawLines = useCallback(() =>
    {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();

        const newLines = links.map(link =>
        {
            const srcEl = document.getElementById(link.sourceId);
            const tgtEl = document.getElementById(link.targetId);
            if (!srcEl || !tgtEl) return null;

            const srcRect = srcEl.getBoundingClientRect();
            const tgtRect = tgtEl.getBoundingClientRect();

            return {
                id: link.id,
                // Target points to Source visually
                x1: tgtRect.left + tgtRect.width / 2 - containerRect.left,
                y1: tgtRect.top + tgtRect.height / 2 - containerRect.top,
                x2: srcRect.left + srcRect.width / 2 - containerRect.left,
                y2: srcRect.top + srcRect.height / 2 - containerRect.top,
                isViolated: link.isViolated
            };
        }).filter(Boolean);

        setLines(newLines);
    }, [ links, containerRef ]);

    useEffect(() =>
    {
        drawLines();

        window.addEventListener('resize', drawLines);

        const container = containerRef.current;
        if (container)
        {
            container.addEventListener('scroll', drawLines);
        }

        const table = container?.querySelector('table');
        let ro: ResizeObserver;
        if (table)
        {
            ro = new ResizeObserver(drawLines);
            ro.observe(table);
        }

        return () =>
        {
            window.removeEventListener('resize', drawLines);
            if (container) container.removeEventListener('scroll', drawLines);
            if (ro) ro.disconnect();
        };
    }, [ drawLines, containerRef ]);

    return (
        <svg
            style={ {
                position: 'absolute',
                top: 0, left: 0,
                width: '100%', height: '100%',
                pointerEvents: 'none',
                zIndex: 10
            } }
        >
            { lines.map(l => (
                <line
                    key={ l.id }
                    x1={ l.x1 } y1={ l.y1 }
                    x2={ l.x2 } y2={ l.y2 }
                    stroke={ l.isViolated ? theme.palette.error.main : theme.palette.text.disabled }
                    strokeWidth={ 2 }
                    strokeDasharray={ l.isViolated ? 'none' : '4 4' }
                />
            )) }
        </svg>
    );
};