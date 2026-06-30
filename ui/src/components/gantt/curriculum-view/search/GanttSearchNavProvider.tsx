"use client";
import {
    ReactNode,
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";

import { GanttSyllabusId } from "@/api-shared/types/gantt/models";

/** DOM id prefix used to anchor a syllabus card for scroll-into-view. */
export const SYLLABUS_ANCHOR_PREFIX = "gantt-syllabus-";

/** DOM id prefix used to anchor an event row inside the module dialog. */
export const EVENT_ANCHOR_PREFIX = "gantt-event-";

/** How long a navigated-to item stays visually highlighted. */
export const HIGHLIGHT_DURATION_MS = 2600;

/** Max animation frames to wait for a progressively-mounted card to appear. */
const MAX_SCROLL_ATTEMPTS = 60;

type GanttSearchNavContextValue = {
    highlightedSyllabusId: GanttSyllabusId | null;
    goToSyllabus: (syllabusId: GanttSyllabusId) => void;
};

const GanttSearchNavContext = createContext<GanttSearchNavContextValue>({
    highlightedSyllabusId: null,
    goToSyllabus: () => {},
});

export function GanttSearchNavProvider({ children }: { children: ReactNode }) {
    const [highlightedSyllabusId, setHighlightedSyllabusId] =
        useState<GanttSyllabusId | null>(null);
    const clearTimerRef = useRef<null | number>(null);

    const goToSyllabus = useCallback((syllabusId: GanttSyllabusId) => {
        setHighlightedSyllabusId(syllabusId);

        // Syllabus cards mount progressively, so the anchor may not exist yet.
        // Retry across animation frames until it shows up (or we give up).
        let attempts = 0;
        const tryScroll = () => {
            const element = document.getElementById(
                `${SYLLABUS_ANCHOR_PREFIX}${syllabusId}`,
            );
            if (element) {
                element.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                    inline: "center",
                });
                return;
            }
            if (attempts++ < MAX_SCROLL_ATTEMPTS) {
                window.requestAnimationFrame(tryScroll);
            }
        };
        window.requestAnimationFrame(tryScroll);

        if (clearTimerRef.current) {
            window.clearTimeout(clearTimerRef.current);
        }
        clearTimerRef.current = window.setTimeout(
            () => setHighlightedSyllabusId(null),
            HIGHLIGHT_DURATION_MS,
        );
    }, []);

    useEffect(
        () => () => {
            if (clearTimerRef.current) {
                window.clearTimeout(clearTimerRef.current);
            }
        },
        [],
    );

    return (
        <GanttSearchNavContext.Provider
            value={{ highlightedSyllabusId, goToSyllabus }}
        >
            {children}
        </GanttSearchNavContext.Provider>
    );
}

export function useGanttSearchNav() {
    return useContext(GanttSearchNavContext);
}
