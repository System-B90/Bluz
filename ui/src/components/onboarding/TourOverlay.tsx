"use client";
import Box from "@mui/material/Box";
import Fade from "@mui/material/Fade";
import Popper from "@mui/material/Popper";
import { alpha, keyframes, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import {
    Fragment,
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react";

import {
    DEFAULT_SPOTLIGHT_PADDING,
    SpotlightRect,
    areRectsEqual,
    toPopperPlacement,
    toSpotlightRect,
} from "@/components/onboarding/core/spotlight";
import { useOnboardingContext } from "@/components/onboarding/OnboardingContext";
import { TourCard } from "@/components/onboarding/TourCard";
import { TourStep } from "@/components/onboarding/types";

/** Above dialogs and drawers, below nothing — the tour is always on top. */
const OVERLAY_Z_INDEX = 2000;

const FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

/** Draws the eye to a control the step is inviting the user to press. */
const invite = keyframes`
    0%, 100% { box-shadow: 0 0 0 4px var(--tour-ring-glow); }
    50% { box-shadow: 0 0 0 10px var(--tour-ring-glow); }
`;

type Viewport = { width: number; height: number };

function readViewport(): Viewport {
    return { width: window.innerWidth, height: window.innerHeight };
}

/**
 * The spotlight itself: four backdrop panes around the cutout, plus a ring.
 *
 * Four panes rather than one SVG mask because the hole is then a real hole —
 * nothing covers the highlighted control, so an interactive step can let the
 * user press the very button the step is describing.
 *
 * The panes swallow clicks but never *act* on them: ending a tour is a
 * deliberate choice (Esc, close, skip), not something a misclick beside the
 * card can do — the more so because a dismissal is remembered.
 */
function SpotlightBackdrop({
    interactive,
    rect,
    reducedMotion,
}: {
    interactive: boolean;
    rect: null | SpotlightRect;
    reducedMotion: boolean;
}) {
    const transition = reducedMotion
        ? "none"
        : "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)";

    // `sx`/emotion goes through the app's RTL stylis plugin, which blindly
    // swaps `left`/`right` in every rule it emits. These boxes are placed
    // with real `getBoundingClientRect()` viewport pixels — already correct
    // physical coordinates, not logical ones — so that swap would mirror the
    // spotlight to the wrong side of the screen. `style` bypasses emotion
    // entirely and is used for every rect-derived offset below.
    const paneSx = {
        position: "fixed" as const,
        // Theme-derived, so the dim is the same weight in both palettes rather
        // than a slate wash that fights a light UI and doubles up on a dark one.
        bgcolor: (theme: { palette: { mode: string; common: { black: string } } }) =>
            alpha(theme.palette.common.black, theme.palette.mode === "dark" ? 0.62 : 0.45),
        zIndex: OVERLAY_Z_INDEX,
        transition,
    };

    if (!rect) {
        return <Box style={{ inset: 0 }} sx={paneSx} />;
    }

    const panes = [
        { top: 0, left: 0, width: "100vw", height: rect.top },
        {
            top: rect.top + rect.height,
            left: 0,
            width: "100vw",
            height: `calc(100vh - ${rect.top + rect.height}px)`,
        },
        { top: rect.top, left: 0, width: rect.left, height: rect.height },
        {
            top: rect.top,
            left: rect.left + rect.width,
            width: `calc(100vw - ${rect.left + rect.width}px)`,
            height: rect.height,
        },
    ];

    return (
        <Fragment>
            {panes.map((pane, index) => (
                <Box key={index} style={pane} sx={paneSx} />
            ))}

            {/* The hole's blocker. Absent on an interactive step, which is what
                makes the spotlighted control clickable through the overlay. */}
            {interactive ? null : (
                <Box
                    style={{
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height,
                    }}
                    sx={{
                        position: "fixed",
                        zIndex: OVERLAY_Z_INDEX,
                    }}
                />
            )}

            <Box
                aria-hidden
                style={{
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                }}
                sx={{
                    position: "fixed",
                    borderRadius: 1.5,
                    border: "2px solid",
                    borderColor: "primary.main",
                    "--tour-ring-glow": (theme: {
                        palette: { primary: { main: string } };
                    }) => alpha(theme.palette.primary.main, 0.3),
                    boxShadow: "0 0 0 4px var(--tour-ring-glow)",
                    animation:
                        interactive && !reducedMotion
                            ? `${invite} 1.8s ease-in-out infinite`
                            : "none",
                    pointerEvents: "none",
                    zIndex: OVERLAY_Z_INDEX + 1,
                    transition,
                }}
            />
        </Fragment>
    );
}

/**
 * One step's spotlight and card.
 *
 * Mounted with the step as its key, so the measured rect and the fade animation
 * start fresh on every step instead of being reset by hand.
 */
function ActiveStepOverlay({ step, tourTitle }: { step: TourStep; tourTitle: string }) {
    const { endTour, goToNextStep, goToPreviousStep, labels, registry, stepCounter } =
        useOnboardingContext();
    const theme = useTheme();
    const titleId = useId();
    const bodyId = useId();
    const isNarrow = useMediaQuery(theme.breakpoints.down("sm"));
    const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

    const cardRef = useRef<HTMLDivElement | null>(null);
    const anchorId = step.anchor;
    const padding = step.padding ?? DEFAULT_SPOTLIGHT_PADDING;

    const measureAnchor = useCallback(() => {
        const element = anchorId ? registry.get(anchorId) : undefined;
        return element
            ? toSpotlightRect(element, padding, readViewport())
            : null;
    }, [anchorId, padding, registry]);

    // Measured on the first render, not in the effect: the step runner already
    // waited for the anchor, so the spotlight is in place for the first paint
    // instead of dimming the whole screen for a frame first.
    const [rect, setRect] = useState<null | SpotlightRect>(measureAnchor);
    const rectRef = useRef<null | SpotlightRect>(rect);

    // One rAF loop for the life of the step: it survives scrolling, layout
    // shifts, tab switches and the app's own animations without needing a
    // listener per source of movement.
    useEffect(() => {
        let frameId = 0;

        const measure = () => {
            const next = measureAnchor();

            if (!areRectsEqual(rectRef.current, next)) {
                rectRef.current = next;
                setRect(next);
            }

            frameId = window.requestAnimationFrame(measure);
        };

        frameId = window.requestAnimationFrame(measure);

        return () => window.cancelAnimationFrame(frameId);
    }, [measureAnchor]);

    // Bring the anchor into view when the step opens, and move focus into the
    // card: without this the dialog is "modal" in name only and Tab walks off
    // into the dimmed page behind it.
    useEffect(() => {
        if (anchorId) {
            // Optional-called: not every environment the app renders in (jsdom
            // in tests, older embedded webviews) implements it.
            registry.get(anchorId)?.scrollIntoView?.({
                block: "center",
                behavior: reducedMotion ? "auto" : "smooth",
            });
        }

        cardRef.current?.focus({ preventScroll: true });
    }, [anchorId, reducedMotion, registry]);

    useEffect(() => {
        const isRtl = theme.direction === "rtl";

        const focusables = (): Array<HTMLElement> => {
            const inCard = [
                ...(cardRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ??
                    []),
            ];
            const anchor = step.interactive && anchorId
                ? registry.get(anchorId)
                : undefined;

            // An interactive step's control joins the cycle: the step invites
            // the user to press it, so it has to be reachable by keyboard too.
            return anchor ? [anchor, ...inCard] : inCard;
        };

        const trapTab = (event: KeyboardEvent) => {
            const targets = focusables();
            if (targets.length === 0) return;

            const first = targets[0];
            const last = targets[targets.length - 1];
            const active = document.activeElement;

            if (event.shiftKey && (active === first || active === cardRef.current)) {
                last.focus();
                event.preventDefault();
            } else if (!event.shiftKey && active === last) {
                first.focus();
                event.preventDefault();
            }
        };

        const onKeyDown = (event: KeyboardEvent) => {
            switch (event.key) {
            case "Tab":
                trapTab(event);
                return;
            case "Escape":
                endTour("dismissed");
                break;
            case "Enter":
                goToNextStep();
                break;
            case "ArrowRight":
                (isRtl ? goToNextStep : goToPreviousStep)();
                break;
            case "ArrowLeft":
                (isRtl ? goToPreviousStep : goToNextStep)();
                break;
            default:
                return;
            }

            event.preventDefault();
        };

        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [
        anchorId,
        endTour,
        goToNextStep,
        goToPreviousStep,
        registry,
        step.interactive,
        theme.direction,
    ]);

    // A virtual anchor, so the card tracks the *cutout* (which is clamped to
    // the viewport) rather than the raw element it was measured from. With no
    // cutout it collapses to a point at the centre of the viewport.
    const virtualAnchor = useMemo(
        () => ({
            getBoundingClientRect: () =>
                rect
                    ? new DOMRect(rect.left, rect.top, rect.width, rect.height)
                    : new DOMRect(
                        window.innerWidth / 2,
                        window.innerHeight / 2,
                        0,
                        0,
                    ),
        }),
        [rect],
    );

    const card = (
        <Box
            aria-describedby={bodyId}
            aria-labelledby={titleId}
            aria-modal="true"
            ref={cardRef}
            role="dialog"
            sx={{ outline: "none" }}
            tabIndex={-1}
        >
            <TourCard
                bodyId={bodyId}
                step={step}
                titleId={titleId}
                tourTitle={tourTitle}
            />
        </Box>
    );

    // Decided by the step, never by the measurement: a rect that arrives a
    // frame later must not swap the card's subtree out from under a click the
    // user has already started.
    const isCentered = step.placement === "center" || step.anchor === undefined;

    return (
        <Fragment>
            <SpotlightBackdrop
                interactive={step.interactive === true}
                rect={rect}
                reducedMotion={reducedMotion}
            />

            {/* Announces each step to a screen reader; the card itself swaps
                its content in place, which is otherwise silent. */}
            <Box
                aria-live="polite"
                sx={{
                    position: "fixed",
                    width: 1,
                    height: 1,
                    overflow: "hidden",
                    clip: "rect(0 0 0 0)",
                    whiteSpace: "nowrap",
                }}
            >
                {`${labels.stepCounter(stepCounter.current, stepCounter.total)} — ${step.title}`}
            </Box>

            {isCentered || isNarrow ? (
                <Box
                    sx={{
                        position: "fixed",
                        zIndex: OVERLAY_Z_INDEX + 2,
                        // On a phone the card is a bottom sheet: a popper wide
                        // enough to read would cover the thing it points at.
                        ...(isNarrow && !isCentered
                            ? {
                                bottom: 16,
                                insetInline: 16,
                                display: "flex",
                                justifyContent: "center",
                            }
                            : {
                                top: "50%",
                                left: "50%",
                                transform: "translate(-50%, -50%)",
                            }),
                    }}
                >
                    <Fade appear in timeout={reducedMotion ? 0 : 180}>
                        {card}
                    </Fade>
                </Box>
            ) : (
                <Popper
                    anchorEl={virtualAnchor}
                    modifiers={[
                        { name: "offset", options: { offset: [0, 14] } },
                        { name: "preventOverflow", options: { padding: 12 } },
                        { name: "flip", options: { padding: 12 } },
                    ]}
                    open
                    placement={toPopperPlacement(step.placement, theme.direction)}
                    sx={{ zIndex: OVERLAY_Z_INDEX + 2 }}
                    transition
                >
                    {({ TransitionProps }) => (
                        <Fade {...TransitionProps} timeout={reducedMotion ? 0 : 180}>
                            {card}
                        </Fade>
                    )}
                </Popper>
            )}
        </Fragment>
    );
}

/**
 * Renders the running tour. Mounted once by `OnboardingProvider`; renders
 * nothing at all when no tour is running.
 */
export function TourOverlay() {
    const { activeStep, activeStepIndex, activeTour } = useOnboardingContext();

    if (!activeStep || !activeTour) return null;

    return (
        <ActiveStepOverlay
            key={`${activeTour.id}:${activeStepIndex}`}
            step={activeStep}
            tourTitle={activeTour.title}
        />
    );
}
