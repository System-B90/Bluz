"use client";
import {
    ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";

import { AnchorRegistry } from "@/components/onboarding/core/anchors";
import { findShowableStep, stepProgress } from "@/components/onboarding/core/steps";
import {
    CompletionMap,
    browserStorage,
    isTourCompleted as isCompleted,
    readCompletions,
    writeCompletions,
} from "@/components/onboarding/core/storage";
import { HelpPanel } from "@/components/onboarding/HelpPanel";
import {
    OnboardingContext,
    OnboardingContextValue,
} from "@/components/onboarding/OnboardingContext";
import { TourOverlay } from "@/components/onboarding/TourOverlay";
import {
    HelpTopic,
    OnboardingLabels,
    OnboardingStorage,
    Tour,
    TourEndReason,
    TourStep,
} from "@/components/onboarding/types";

const DEFAULT_ANCHOR_TIMEOUT_MS = 4000;
/** Long enough for the screen behind the tour to finish its first paint. */
const AUTO_START_DELAY_MS = 700;

export type OnboardingProviderProps = {
    children: ReactNode;
    /** The copy table. Must be referentially stable. */
    labels: OnboardingLabels;
    /** Prefix for persisted keys — one per app, so two apps never collide. */
    storageNamespace: string;
    /** Swap in a server-backed store to make "seen" follow the user. */
    storage?: OnboardingStorage;
    /** Set `false` to require every tour to be started by hand. */
    autoStart?: boolean;
    onTourEnd?: (tourId: string, reason: TourEndReason) => void;
};

type ActiveTourState = { tour: Tour; stepIndex: number };

/**
 * Owns the anchor registry, the tour/topic registries, the running tour and the
 * help panel — and renders the overlay and the panel itself, so a host app only
 * has to mount this once, above everything that contributes a tour or an anchor.
 */
export function OnboardingProvider({
    children,
    labels,
    storageNamespace,
    storage = browserStorage,
    autoStart = true,
    onTourEnd,
}: OnboardingProviderProps) {
    const registry = useMemo(() => new AnchorRegistry(), []);
    const [tours, setTours] = useState<ReadonlyMap<string, Tour>>(
        () => new Map(),
    );
    const [topicGroups, setTopicGroups] = useState<
        ReadonlyArray<ReadonlyArray<HelpTopic>>
    >([]);
    const [active, setActive] = useState<ActiveTourState | null>(null);
    const [isHelpOpen, setHelpOpen] = useState(false);
    // Read once, lazily. On the server the store is empty by construction, and
    // nothing rendered depends on it — only the auto-start effect does, and that
    // never runs there — so reading it here cannot desync hydration.
    const [completions, setCompletions] = useState<CompletionMap>(() =>
        readCompletions(storage, storageNamespace),
    );

    const activeRef = useRef<ActiveTourState | null>(null);
    activeRef.current = active;
    // Cancels an in-flight step transition when a newer one starts.
    const transitionRef = useRef(0);
    const autoStartedRef = useRef(new Set<string>());

    const canShowStep = useCallback(
        (step: TourStep) =>
            !step.optional || !step.anchor || registry.has(step.anchor),
        [registry],
    );

    const registerTour = useCallback((tour: Tour) => {
        setTours((prev) => new Map(prev).set(tour.id, tour));

        return () => {
            setTours((prev) => {
                const next = new Map(prev);
                next.delete(tour.id);
                return next;
            });
            setActive((current) =>
                current?.tour.id === tour.id ? null : current,
            );
        };
    }, []);

    const registerTopics = useCallback((topics: ReadonlyArray<HelpTopic>) => {
        setTopicGroups((prev) => [...prev, topics]);

        return () => {
            setTopicGroups((prev) => prev.filter((group) => group !== topics));
        };
    }, []);

    const recordCompletion = useCallback(
        (tour: Tour, reason: TourEndReason) => {
            setCompletions((prev) => {
                const next: CompletionMap = {
                    ...prev,
                    [tour.id]: {
                        version: tour.version ?? 1,
                        at: new Date().toISOString(),
                        reason,
                    },
                };
                writeCompletions(storage, storageNamespace, next);
                return next;
            });
        },
        [storage, storageNamespace],
    );

    const endTour = useCallback(
        (reason: TourEndReason) => {
            const current = activeRef.current;
            if (!current) return;

            transitionRef.current += 1;
            activeRef.current = null;
            setActive(null);
            // Dismissing counts as "seen" too — a tour the user walked out of
            // should not ambush them again on the next visit.
            recordCompletion(current.tour, reason);
            onTourEnd?.(current.tour.id, reason);
        },
        [onTourEnd, recordCompletion],
    );

    /** Resolves once the step's anchor is registered, or the wait times out. */
    const waitForAnchor = useCallback(
        async (step: TourStep, timeoutMs: number) => {
            if (!step.anchor || registry.has(step.anchor)) return;

            await new Promise<void>((resolve) => {
                const timeoutId = setTimeout(finish, timeoutMs);
                const unsubscribe = registry.subscribe(() => {
                    if (step.anchor && registry.has(step.anchor)) finish();
                });

                function finish() {
                    clearTimeout(timeoutId);
                    unsubscribe();
                    resolve();
                }
            });
        },
        [registry],
    );

    /**
     * Walks in `direction` until it lands on a step it can actually show:
     * each candidate gets its `beforeShow` ran and its anchor waited for, and
     * an optional step whose anchor never arrives is passed over.
     */
    const moveStep = useCallback(
        async (direction: -1 | 1, fromIndex: number) => {
            const current = activeRef.current;
            if (!current) return;

            const { tour } = current;
            const timeoutMs = tour.anchorTimeoutMs ?? DEFAULT_ANCHOR_TIMEOUT_MS;
            const transitionId = (transitionRef.current += 1);
            let index = fromIndex;

            for (;;) {
                const nextIndex = findShowableStep(
                    tour.steps,
                    index,
                    direction,
                    canShowStep,
                );

                if (nextIndex === null) {
                    // Off the end is a finished tour; off the start is a step
                    // that simply has nothing before it, so stay put.
                    if (direction === 1) endTour("completed");
                    return;
                }

                const step = tour.steps[nextIndex];
                await step.beforeShow?.();
                if (transitionRef.current !== transitionId) return;

                await waitForAnchor(step, timeoutMs);
                if (transitionRef.current !== transitionId) return;

                const anchorMissing =
                    step.anchor !== undefined && !registry.has(step.anchor);

                if (anchorMissing && step.optional) {
                    index = nextIndex;
                    continue;
                }

                setActive({ tour, stepIndex: nextIndex });
                return;
            }
        },
        [canShowStep, endTour, registry, waitForAnchor],
    );

    const startTour = useCallback(
        (tourId: string) => {
            const tour = tours.get(tourId);
            if (!tour || tour.steps.length === 0) return;

            setHelpOpen(false);
            activeRef.current = { tour, stepIndex: -1 };
            setActive({ tour, stepIndex: -1 });
            void moveStep(1, -1);
        },
        [moveStep, tours],
    );

    const goToNextStep = useCallback(() => {
        const current = activeRef.current;
        if (current) void moveStep(1, current.stepIndex);
    }, [moveStep]);

    const goToPreviousStep = useCallback(() => {
        const current = activeRef.current;
        if (current) void moveStep(-1, current.stepIndex);
    }, [moveStep]);

    const isTourCompleted = useCallback(
        (tourId: string) => {
            const tour = tours.get(tourId);
            return tour ? isCompleted(completions, tour) : false;
        },
        [completions, tours],
    );

    const forgetTour = useCallback(
        (tourId: string) => {
            autoStartedRef.current.delete(tourId);
            setCompletions((prev) => {
                const next = { ...prev };
                delete next[tourId];
                writeCompletions(storage, storageNamespace, next);
                return next;
            });
        },
        [storage, storageNamespace],
    );

    // First run: start the first registered tour the user has not seen yet,
    // once the screen it describes has had a moment to render.
    useEffect(() => {
        if (!autoStart || active) return;

        const candidate = [...tours.values()].find(
            (tour) =>
                tour.autoStart === true &&
                !autoStartedRef.current.has(tour.id) &&
                !isCompleted(completions, tour),
        );

        if (!candidate) return;

        const timeoutId = setTimeout(() => {
            autoStartedRef.current.add(candidate.id);
            startTour(candidate.id);
        }, AUTO_START_DELAY_MS);

        return () => clearTimeout(timeoutId);
    }, [active, autoStart, completions, startTour, tours]);

    const topics = useMemo(() => topicGroups.flat(), [topicGroups]);

    const activeStep =
        active && active.stepIndex >= 0
            ? (active.tour.steps[active.stepIndex] ?? null)
            : null;

    const counter = useMemo(
        () =>
            active && activeStep
                ? stepProgress(active.tour.steps, active.stepIndex, canShowStep)
                : { current: 1, total: 1 },
        [active, activeStep, canShowStep],
    );

    const value = useMemo<OnboardingContextValue>(
        () => ({
            labels,
            registry,
            activeTour: active?.tour ?? null,
            activeStep,
            activeStepIndex: active?.stepIndex ?? -1,
            startTour,
            endTour,
            goToNextStep,
            goToPreviousStep,
            isFirstStep:
                active === null ||
                findShowableStep(
                    active.tour.steps,
                    active.stepIndex,
                    -1,
                    canShowStep,
                ) === null,
            isLastStep:
                active === null ||
                findShowableStep(
                    active.tour.steps,
                    active.stepIndex,
                    1,
                    canShowStep,
                ) === null,
            stepCounter: counter,
            tours,
            topics,
            registerTour,
            registerTopics,
            isTourCompleted,
            forgetTour,
            isHelpOpen,
            openHelp: () => setHelpOpen(true),
            closeHelp: () => setHelpOpen(false),
        }),
        [
            active,
            activeStep,
            canShowStep,
            counter,
            endTour,
            forgetTour,
            goToNextStep,
            goToPreviousStep,
            isHelpOpen,
            isTourCompleted,
            labels,
            registerTopics,
            registerTour,
            registry,
            startTour,
            topics,
            tours,
        ],
    );

    return (
        <OnboardingContext.Provider value={value}>
            {children}
            <TourOverlay />
            <HelpPanel />
        </OnboardingContext.Provider>
    );
}
