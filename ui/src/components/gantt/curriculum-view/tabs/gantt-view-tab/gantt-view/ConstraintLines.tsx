import { useTheme } from "@mui/material/styles";
import React, { useCallback, useEffect, useState } from "react";

import { ConstraintLink } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";

type ConstraintLinesProps = {
    links: Array<ConstraintLink>;
    containerRef: React.RefObject<HTMLDivElement | null>;
};

export const ConstraintLines: React.FC<ConstraintLinesProps> = ({
    links,
    containerRef,
}) => {
    const theme = useTheme();
    const [lines, setLines] = useState<Array<any>>([]);
    // DOM id ("block-module-…"/"block-event-…") of the hovered Gantt block (#106).
    const [hoveredBlockId, setHoveredBlockId] = useState<null | string>(null);

    const drawLines = useCallback(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const containerRect = container.getBoundingClientRect();

        const newLines = links
            .map((link) => {
                const srcEl = document.getElementById(link.sourceId);
                const tgtEl = document.getElementById(link.targetId);
                if (!srcEl || !tgtEl) return null;

                const srcRect = srcEl.getBoundingClientRect();
                const tgtRect = tgtEl.getBoundingClientRect();

                return {
                    id: link.id,
                    sourceId: link.sourceId,
                    targetId: link.targetId,
                    // Target points to Source visually
                    x1: tgtRect.left + tgtRect.width / 2 - containerRect.left,
                    y1: tgtRect.top + tgtRect.height / 2 - containerRect.top,
                    x2: srcRect.left + srcRect.width / 2 - containerRect.left,
                    y2: srcRect.top + srcRect.height / 2 - containerRect.top,
                    isViolated: link.isViolated,
                };
            })
            .filter(Boolean);

        setLines(newLines);
    }, [links, containerRef]);

    useEffect(() => {
        drawLines();

        window.addEventListener("resize", drawLines);

        const container = containerRef.current;
        if (container) {
            container.addEventListener("scroll", drawLines);
        }

        const table = container?.querySelector("table");
        let ro: ResizeObserver;
        if (table) {
            ro = new ResizeObserver(drawLines);
            ro.observe(table);
        }

        return () => {
            window.removeEventListener("resize", drawLines);
            if (container) container.removeEventListener("scroll", drawLines);
            if (ro) ro.disconnect();
        };
    }, [drawLines, containerRef]);

    // Delegated hover tracking: highlight the hovered block's constraint
    // lines and fade all others (#106).
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const findBlockId = (target: EventTarget | null): null | string => {
            if (!(target instanceof Element)) return null;
            const el = target.closest('[id^="block-"]');
            return el?.id ?? null;
        };
        const handleMouseOver = (e: MouseEvent) =>
            setHoveredBlockId(findBlockId(e.target));
        const handleMouseLeave = () => setHoveredBlockId(null);

        container.addEventListener("mouseover", handleMouseOver);
        container.addEventListener("mouseleave", handleMouseLeave);
        return () => {
            container.removeEventListener("mouseover", handleMouseOver);
            container.removeEventListener("mouseleave", handleMouseLeave);
        };
    }, [containerRef]);

    // Only dim unrelated lines when the hovered block actually has lines.
    const hasHoveredLines =
        hoveredBlockId !== null &&
        lines.some(
            (l) =>
                l.sourceId === hoveredBlockId || l.targetId === hoveredBlockId,
        );

    return (
        <svg
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                pointerEvents: "none",
                zIndex: 10,
            }}
        >
            {lines.map((l) => {
                const isConnected =
                    hasHoveredLines &&
                    (l.sourceId === hoveredBlockId ||
                        l.targetId === hoveredBlockId);
                return (
                    <line
                        key={l.id}
                        opacity={hasHoveredLines && !isConnected ? 0.15 : 1}
                        stroke={
                            l.isViolated
                                ? theme.palette.error.main
                                : isConnected
                                    ? theme.palette.primary.main
                                    : theme.vars.palette.text.disabled
                        }
                        strokeDasharray={l.isViolated ? "none" : "4 4"}
                        strokeWidth={isConnected ? 3 : 2}
                        style={{
                            transition:
                                "opacity 0.15s ease, stroke 0.15s ease, stroke-width 0.15s ease",
                        }}
                        x1={l.x1}
                        x2={l.x2}
                        y1={l.y1}
                        y2={l.y2}
                    />
                );
            })}
        </svg>
    );
};
