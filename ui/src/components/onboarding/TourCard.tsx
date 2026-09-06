"use client";
import CloseIcon from "@mui/icons-material/Close";
import TouchAppIcon from "@mui/icons-material/TouchApp";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

import { useOnboardingContext } from "@/components/onboarding/OnboardingContext";
import { TourStep } from "@/components/onboarding/types";

export type TourCardProps = {
    step: TourStep;
    /** Rendered inside the tour's `role="dialog"`, so it labels the dialog. */
    titleId: string;
    bodyId: string;
    /** Names the tour the step belongs to, above its title. */
    tourTitle: string;
};

/**
 * The step card: title, body, progress dots and the navigation buttons.
 *
 * Pure MUI surfaces — `Paper` elevation, palette colors, the theme's radius —
 * so it inherits the host app's light/dark palette and RTL flow for free.
 */
export function TourCard({ step, titleId, bodyId, tourTitle }: TourCardProps) {
    const {
        labels,
        endTour,
        goToNextStep,
        goToPreviousStep,
        isFirstStep,
        isLastStep,
        stepCounter,
    } = useOnboardingContext();

    return (
        <Paper
            elevation={8}
            sx={{
                width: "min(360px, calc(100vw - 32px))",
                p: 2,
                borderRadius: 2,
                // Cancel MUI's dark-mode elevation overlay so the card reads as
                // one flat surface against the dimmed screen behind it.
                backgroundImage: "none",
                border: "1px solid",
                borderColor: "divider",
            }}
        >
            <Stack
                alignItems="flex-start"
                direction="row"
                justifyContent="space-between"
                spacing={1}
            >
                <Box sx={{ minWidth: 0 }}>
                    {/* Which tour this is — a card met mid-flow otherwise names
                        only its step, and reads as an ad. */}
                    <Typography
                        color="text.secondary"
                        display="block"
                        variant="overline"
                    >
                        {tourTitle}
                    </Typography>

                    <Typography fontWeight={600} id={titleId} variant="subtitle1">
                        {step.title}
                    </Typography>
                </Box>

                <Tooltip title={labels.closeTourAria}>
                    <IconButton
                        aria-label={labels.closeTourAria}
                        edge="end"
                        onClick={() => endTour("dismissed")}
                        // A comfortable target: this is the only exit once the
                        // first step's "skip" has turned into "back".
                        sx={{ width: 44, height: 44, flexShrink: 0 }}
                    >
                        <CloseIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            </Stack>

            <Typography
                color="text.secondary"
                component="div"
                id={bodyId}
                sx={{ mt: 1 }}
                variant="body2"
            >
                {step.body}
            </Typography>

            {step.interactive === true ? (
                <Stack
                    alignItems="center"
                    direction="row"
                    spacing={0.5}
                    sx={{ mt: 1.5, color: "primary.main" }}
                >
                    <TouchAppIcon fontSize="small" />

                    <Typography color="inherit" variant="caption">
                        {labels.interactiveHint}
                    </Typography>
                </Stack>
            ) : null}

            <Stack
                alignItems="center"
                direction="row"
                justifyContent="space-between"
                sx={{ mt: 2 }}
            >
                <Stack alignItems="center" direction="row" spacing={1}>
                    <Box
                        aria-hidden
                        sx={{ display: "flex", gap: 0.5, alignItems: "center" }}
                    >
                        {Array.from({ length: stepCounter.total }, (_, dot) => (
                            <Box
                                key={dot}
                                sx={{
                                    width: 6,
                                    height: 6,
                                    borderRadius: "50%",
                                    bgcolor:
                                        dot < stepCounter.current
                                            ? "primary.main"
                                            : "action.disabled",
                                    transition: "background-color 0.2s ease",
                                }}
                            />
                        ))}
                    </Box>

                    <Typography color="text.secondary" variant="caption">
                        {labels.stepCounter(
                            stepCounter.current,
                            stepCounter.total,
                        )}
                    </Typography>
                </Stack>

                <Stack direction="row" spacing={1}>
                    {isFirstStep ? (
                        <Button
                            color="inherit"
                            onClick={() => endTour("dismissed")}
                            size="small"
                        >
                            {labels.skip}
                        </Button>
                    ) : (
                        <Button
                            color="inherit"
                            onClick={goToPreviousStep}
                            size="small"
                        >
                            {labels.back}
                        </Button>
                    )}

                    <Button
                        onClick={goToNextStep}
                        size="small"
                        variant="contained"
                    >
                        {isLastStep ? labels.done : labels.next}
                    </Button>
                </Stack>
            </Stack>
        </Paper>
    );
}
