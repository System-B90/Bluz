"use client";
import CloseIcon from "@mui/icons-material/Close";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListSubheader from "@mui/material/ListSubheader";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { Fragment, useMemo } from "react";

import { useOnboardingContext } from "@/components/onboarding/OnboardingContext";
import { HelpTopic } from "@/components/onboarding/types";

const DRAWER_WIDTH = 380;
const DEFAULT_GROUP = "";

function groupTopics(
    topics: ReadonlyArray<HelpTopic>,
): Array<[string, Array<HelpTopic>]> {
    const groups = new Map<string, Array<HelpTopic>>();

    topics.forEach((topic, index) => {
        const key = topic.group ?? DEFAULT_GROUP;
        const bucket = groups.get(key) ?? [];
        // Registration order is the tie-break, so a contributor gets a stable
        // list without having to number every topic it owns.
        bucket.push({ ...topic, order: topic.order ?? index });
        groups.set(key, bucket);
    });

    return [...groups.entries()].map(([group, groupTopicList]) => [
        group,
        groupTopicList.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    ]);
}

/**
 * The persistent half of onboarding: a drawer of the concepts the current
 * screen contributed, each optionally offering to replay the tour it belongs
 * to. Mounted once by `OnboardingProvider`; opened with `useOnboarding().openHelp`.
 */
export function HelpPanel() {
    const { closeHelp, isHelpOpen, labels, startTour, topics, tours } =
        useOnboardingContext();

    const grouped = useMemo(() => groupTopics(topics), [topics]);
    const replayableTours = useMemo(
        () => [...tours.values()].filter((tour) => tour.steps.length > 0),
        [tours],
    );

    return (
        <Drawer
            anchor="right"
            onClose={closeHelp}
            open={isHelpOpen}
            slotProps={{
                paper: {
                    sx: {
                        width: "min(100vw, " + DRAWER_WIDTH + "px)",
                        backgroundImage: "none",
                    },
                },
            }}
        >
            <Stack
                alignItems="center"
                direction="row"
                justifyContent="space-between"
                sx={{ p: 2, pb: 1 }}
            >
                <Typography fontWeight={600} variant="h6">
                    {labels.help.title}
                </Typography>

                <IconButton
                    aria-label={labels.help.close}
                    onClick={closeHelp}
                    size="small"
                >
                    <CloseIcon fontSize="small" />
                </IconButton>
            </Stack>

            <Divider />

            <Box sx={{ overflowY: "auto", pb: 2 }}>
                {topics.length === 0 ? (
                    // An empty panel is a dead end otherwise: say what is
                    // missing, and offer the one thing there is to do here.
                    <Stack spacing={1} sx={{ p: 2 }}>
                        <Typography color="text.secondary" variant="body2">
                            {labels.help.empty}
                        </Typography>

                        <Typography color="text.secondary" variant="body2">
                            {labels.help.emptyHint}
                        </Typography>

                        {replayableTours.length > 0 ? (
                            <Button
                                onClick={() => startTour(replayableTours[0].id)}
                                size="small"
                                startIcon={
                                    <PlayCircleOutlineIcon fontSize="small" />
                                }
                                sx={{ alignSelf: "flex-start" }}
                                variant="outlined"
                            >
                                {replayableTours[0].title}
                            </Button>
                        ) : null}
                    </Stack>
                ) : null}

                {grouped.map(([group, groupTopics]) => (
                    <List
                        key={group || "default"}
                        subheader={
                            group ? (
                                <ListSubheader
                                    disableSticky
                                    sx={{ bgcolor: "transparent" }}
                                >
                                    {group}
                                </ListSubheader>
                            ) : undefined
                        }
                    >
                        {groupTopics.map((topic) => (
                            <Box key={topic.id} sx={{ px: 2, py: 1 }}>
                                <Typography fontWeight={600} variant="subtitle2">
                                    {topic.title}
                                </Typography>

                                <Typography
                                    color="text.secondary"
                                    component="div"
                                    sx={{ mt: 0.5 }}
                                    variant="body2"
                                >
                                    {topic.body}
                                </Typography>

                                {topic.tourId && tours.has(topic.tourId) ? (
                                    <Button
                                        onClick={() =>
                                            startTour(topic.tourId as string)
                                        }
                                        size="small"
                                        startIcon={
                                            <PlayCircleOutlineIcon fontSize="small" />
                                        }
                                        sx={{ mt: 0.5 }}
                                    >
                                        {labels.help.replayTour}
                                    </Button>
                                ) : null}
                            </Box>
                        ))}
                    </List>
                ))}

                {/* Only alongside topics: with an empty panel the same button
                    is already the empty state's call to action. */}
                {/* Only alongside topics: in an empty panel the same button is
                    already the empty state's call to action. */}
                {replayableTours.length > 0 && topics.length > 0 ? (
                    <Fragment>
                        <Divider sx={{ my: 1 }} />

                        <List
                            subheader={
                                <ListSubheader
                                    disableSticky
                                    sx={{ bgcolor: "transparent" }}
                                >
                                    {labels.help.toursGroup}
                                </ListSubheader>
                            }
                        >
                            {replayableTours.map((tour) => (
                                <Box key={tour.id} sx={{ px: 2, py: 0.5 }}>
                                    <Button
                                        onClick={() => startTour(tour.id)}
                                        size="small"
                                        startIcon={
                                            <PlayCircleOutlineIcon fontSize="small" />
                                        }
                                    >
                                        {tour.title}
                                    </Button>
                                </Box>
                            ))}
                        </List>
                    </Fragment>
                ) : null}
            </Box>
        </Drawer>
    );
}
