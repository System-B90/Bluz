"use client";
import Box from "@mui/material/Box";
import Fade from "@mui/material/Fade";
import Popper from "@mui/material/Popper";
import { useTheme } from "@mui/material/styles";
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
 */
function SpotlightBackdrop({
    rect,
    interactive,
    onBackdropClick,
}: {
    rect: null | SpotlightRect;
    interactive: boolean;
    onBackdropClick: () => void;
}) {
    const paneSx = {
        position: "fixed" as const,
        bgcolor: "rgba(15, 23, 42, 0.55)",
        zIndex: OVERLAY_Z_INDEX,
        transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
    };

    if (!rect) {
        return (
            <Box
                onClick={onBackdropClick}
                sx={{ ...paneSx, inset: 0 }}
            />
        );
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
                <Box
                    key={index}
                    onClick={onBackdropClick}
                    sx={{ ...paneSx, ...pane }}
                />
            ))}

            {/* The hole's blocker. Absent on an interactive step, which is what
                makes the spotlighted control clickable through the overlay. */}
            {interactive ? null : (
                <Box
                    onClick={onBackdropClick}
                    sx={{
                        position: "fixed",
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height,
                        zIndex: OVERLAY_Z_INDEX,
                    }}
                />
            )}

            <Box
                aria-hidden
                sx={{
                    position: "fixed",
                    top: rect.top,
                    left: rect.left,
                    width: rect.width,
                    height: rect.height,
                    borderRadius: 1.5,
                    border: "2px solid",
                    borderColor: "primary.main",
                    boxShadow: (theme) =>
                        `0 0 0 4px ${theme.palette.primary.main}33`,
                    pointerEvents: "none",
                    zIndex: OVERLAY_Z_INDEX + 1,
                    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                }}
            />
        </Fragment>
    );
}

/**
 * Renders the running tour. Mounted once by `OnboardingProvider`; renders
 * nothing at all when no tour is running.
 */
type ActiveStepOverlayProps = {
    step: TourStep;
    tourId: string;
};

/**
 * One step's spotlight and card.
 *
 * Mounted with the step as its key, so the measured rect and the fade animation
 * start fresh on every step instead of being reset by hand.
 */
function ActiveStepOverlay({ step }: ActiveStepOverlayProps) {
    const { endTour, goToNextStep, goToPreviousStep, registry } =
        useOnboardingContext();
    const theme = useTheme();
    const titleId = useId();
    const bodyId = useId();

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

    // Bring the anchor into view when the step opens.
    useEffect(() => {
        if (!anchorId) return;

        // Optional-called: not every environment the app renders in (jsdom in
        // tests, older embedded webviews) implements it.
        registry.get(anchorId)?.scrollIntoView?.({
            block: "center",
            behavior: "smooth",
        });
    }, [anchorId, registry]);

    useEffect(() => {
        const isRtl = theme.direction === "rtl";

        const onKeyDown = (event: KeyboardEvent) => {
            switch (event.key) {
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
    }, [endTour, goToNextStep, goToPreviousStep, theme.direction]);

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
            role="dialog"
        >
            <TourCard bodyId={bodyId} step={step} titleId={titleId} />
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
                onBackdropClick={() => endTour("dismissed")}
                rect={rect}
            />

            {isCentered ? (
                <Box
                    sx={{
                        position: "fixed",
                        top: "50%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        zIndex: OVERLAY_Z_INDEX + 2,
                    }}
                >
                    <Fade appear in timeout={180}>
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
                        <Fade {...TransitionProps} timeout={180}>
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
            tourId={activeTour.id}
        />
    );
}
