import { useCallback, useEffect, useRef, useState } from "react";

// Reveal an unallocated module/event: expand its ancestors, then scroll its
// row into view once rendered (#89, #325).
export const useGanttReveal = ({
    exposeSyllabusFor,
    expandModuleFor,
    registerRevealHandler,
}: {
    exposeSyllabusFor: (syllabusId: string) => void;
    expandModuleFor: (moduleId: string) => void;
    registerRevealHandler: (
        handler: (syllabusId: string, moduleId: string, eventId?: string) => void,
    ) => () => void;
}) =>
{
    const pendingScrollRafs = useRef<Array<number>>([]);
    // DOM id of a row to scroll into view once its ancestors have expanded.
    const [ pendingScrollId, setPendingScrollId ] = useState<null | string>(null);

    const revealItem = useCallback(
        (syllabusId: string, moduleId: string, eventId?: string) =>
        {
            exposeSyllabusFor(syllabusId);
            if (eventId) expandModuleFor(moduleId);
            setPendingScrollId(
                eventId
                    ? `gantt-row-event-${eventId}`
                    : `gantt-row-module-${moduleId}`,
            );
        },
        [ exposeSyllabusFor, expandModuleFor ],
    );

    // Expose this view's reveal behavior so other flows (event create/
    // duplicate) can scroll-to + flash a new row without a direct ref (#325).
    useEffect(
        () => registerRevealHandler(revealItem),
        [ registerRevealHandler, revealItem ],
    );

    // After the target's ancestors expand, scroll to it and flash a highlight.
    useEffect(() =>
    {
        if (!pendingScrollId) return;
        const raf1 = requestAnimationFrame(() =>
        {
            const raf2 = requestAnimationFrame(() =>
            {
                const el = document.getElementById(pendingScrollId);
                if (el)
                {
                    el.scrollIntoView({ behavior: "smooth", block: "center" });
                    el.dataset.ganttFlash = "true";
                    window.setTimeout(() =>
                    {
                        delete el.dataset.ganttFlash;
                    }, 1500);
                }
                setPendingScrollId(null);
            });
            pendingScrollRafs.current.push(raf2);
        });
        pendingScrollRafs.current.push(raf1);
        return () =>
        {
            pendingScrollRafs.current.forEach((id) =>
                cancelAnimationFrame(id),
            );
            pendingScrollRafs.current = [];
        };
    }, [ pendingScrollId ]);

    return { revealItem };
};
