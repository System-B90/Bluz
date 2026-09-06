import { ReactNode } from "react";

/**
 * Stable name for a spotlight target. Steps reference anchors by id rather
 * than by CSS selector, so a component is free to restyle or re-nest its DOM
 * without silently breaking a tour.
 */
export type TourAnchorId = string;

/**
 * Where the card sits relative to its anchor, in logical terms — `inline-start`
 * is the left in LTR and the right in RTL. `center` ignores the anchor and
 * centres the card, which is also the fallback when an anchor never shows up.
 */
export type TourPlacement =
    | "block-end"
    | "block-start"
    | "center"
    | "inline-end"
    | "inline-start";

export type TourStep = {
    /** Unique within its tour. Used as the React key and in analytics. */
    id: string;
    title: string;
    body: ReactNode;
    /** Element to spotlight. Omit for a centred, anchor-less step. */
    anchor?: TourAnchorId;
    placement?: TourPlacement;
    /** Extra space, in px, between the anchor's box and the cutout's edge. */
    padding?: number;
    /**
     * Ran before the step is shown, and awaited. This is how a tour opens the
     * drawer or switches to the tab that holds the next anchor.
     */
    beforeShow?: () => Promise<void> | void;
    /**
     * Leaves the spotlighted element clickable through the overlay, so a step
     * can invite the user to press the control it is describing.
     */
    interactive?: boolean;
    /**
     * When the anchor never appears, an optional step is skipped instead of
     * degrading to a centred card. Use it for steps about UI that only exists
     * in some states.
     */
    optional?: boolean;
};

export type Tour = {
    /** Stable across releases — it is the persistence key. */
    id: string;
    title: string;
    steps: Array<TourStep>;
    /**
     * Bump to re-show a tour whose content materially changed. A completion
     * recorded against an older version no longer counts.
     */
    version?: number;
    /** Run once, by itself, the first time it is registered. */
    autoStart?: boolean;
    /** How long to wait for a step's anchor to mount, in ms. */
    anchorTimeoutMs?: number;
};

/** An entry in the persistent help panel. */
export type HelpTopic = {
    id: string;
    title: string;
    body: ReactNode;
    /** Section heading in the panel. Topics without one land in the default section. */
    group?: string;
    /** Lower sorts first within a section. Defaults to registration order. */
    order?: number;
    /** Renders a "replay this tour" action at the end of the topic. */
    tourId?: string;
};

/** Why a tour stopped — reported to `onTourEnd`, and what decides persistence. */
export type TourEndReason = "completed" | "dismissed";

export type OnboardingLabels = {
    next: string;
    back: string;
    skip: string;
    done: string;
    /** e.g. `(2, 5) => "2 of 5"`. */
    stepCounter: (current: number, total: number) => string;
    closeTourAria: string;
    /** Shown on a step that invites the user to press the spotlighted control. */
    interactiveHint: string;
    help: {
        title: string;
        openAria: string;
        close: string;
        replayTour: string;
        empty: string;
        /** Second line of the empty state — what to do about it. */
        emptyHint: string;
        toursGroup: string;
    };
};

/** Storage seam. Swap it for a server-backed profile without touching the UI. */
export type OnboardingStorage = {
    read: (key: string) => null | string;
    write: (key: string, value: string) => void;
};
