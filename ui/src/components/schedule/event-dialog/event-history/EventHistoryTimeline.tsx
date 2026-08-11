import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import ScheduleIcon from "@mui/icons-material/Schedule";
import SmartToyOutlinedIcon from "@mui/icons-material/SmartToyOutlined";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import dayjs from "dayjs";

import { eventFieldLabel, INITIATOR_LABELS } from "@/api-shared/event-history";
import {
    ApiEventHistoryEntry,
    EventChangeAction,
    isGanttInitiator,
} from "@/api-shared/types/event-history";
import {
    ChangeValueLookups,
    formatChange,
    relativeTime,
} from "@/components/schedule/event-dialog/event-history/format-change";
import {
    ACTION_ICONS,
    presentationFor,
} from "@/components/schedule/event-dialog/event-history/initiator-presentation";

/**
 * The change log as a vertical timeline: one marker per change, colour-coded
 * by what produced it, with the changed fields shown as before → after pairs.
 */

export type EventHistoryTimelineProps = {
    entries: Array<ApiEventHistoryEntry>;
    lookups: ChangeValueLookups;
};

const ACTION_LABELS: Record<EventChangeAction, string> = {
    [EventChangeAction.Archived]: "נמחק",
    [EventChangeAction.Created]: "נוצר",
    [EventChangeAction.Updated]: "עודכן",
};

function ChangeRow({
    change,
    lookups,
}: {
    change: ApiEventHistoryEntry["changes"][number];
    lookups: ChangeValueLookups;
}) {
    const { field, from, to } = formatChange(change, lookups);

    return (
        <Stack
            alignItems="center"
            direction="row"
            flexWrap="wrap"
            gap={0.75}
            sx={{ minWidth: 0 }}
        >
            <Typography
                sx={{ color: "text.secondary", fontWeight: 600 }}
                variant="caption"
            >
                {eventFieldLabel(field)}
            </Typography>
            <Chip
                label={from}
                size="small"
                sx={{
                    "& .MuiChip-label": { px: 0.75 },
                    height: 22,
                    maxWidth: 220,
                    textDecoration: "line-through",
                    // The struck-through "before" recedes; the "after" leads.
                    opacity: 0.7,
                }}
                variant="outlined"
            />
            {/* RTL: the arrow points along the reading direction. */}
            <ArrowBackIcon
                fontSize="inherit"
                sx={{ color: "text.disabled", fontSize: 14 }}
            />
            <Chip
                color="primary"
                label={to}
                size="small"
                sx={{
                    "& .MuiChip-label": { px: 0.75 },
                    height: 22,
                    maxWidth: 220,
                }}
                variant="outlined"
            />
        </Stack>
    );
}

function TimelineEntry({
    entry,
    isLast,
    lookups,
}: {
    entry: ApiEventHistoryEntry;
    isLast: boolean;
    lookups: ChangeValueLookups;
}) {
    const { color, icon } = presentationFor(entry.initiator);
    const machineWrite = isGanttInitiator(entry.initiator) || !entry.actorId;

    return (
        <Stack direction="row" gap={1.5} sx={{ minWidth: 0 }}>
            {/* Marker + connector rail. */}
            <Stack alignItems="center" sx={{ flexShrink: 0, width: 32 }}>
                <Box
                    sx={{
                        alignItems: "center",
                        bgcolor: (theme) => theme.palette[color].main,
                        borderRadius: "50%",
                        color: (theme) => theme.palette[color].contrastText,
                        display: "flex",
                        height: 32,
                        justifyContent: "center",
                        transition: (theme) =>
                            theme.transitions.create("box-shadow", {
                                duration: theme.transitions.duration.shorter,
                            }),
                        width: 32,
                    }}
                >
                    {icon}
                </Box>
                {!isLast && (
                    <Box
                        sx={{
                            bgcolor: "divider",
                            flexGrow: 1,
                            minHeight: 12,
                            my: 0.5,
                            width: "2px",
                        }}
                    />
                )}
            </Stack>

            <Stack gap={0.75} sx={{ minWidth: 0, pb: isLast ? 0 : 2 }}>
                <Stack
                    alignItems="center"
                    direction="row"
                    flexWrap="wrap"
                    gap={0.75}
                >
                    <Typography sx={{ fontWeight: 600 }} variant="body2">
                        {INITIATOR_LABELS[entry.initiator] ?? entry.initiator}
                    </Typography>
                    <Chip
                        icon={ACTION_ICONS[entry.action]}
                        label={ACTION_LABELS[entry.action]}
                        size="small"
                        sx={{ "& .MuiChip-label": { px: 0.75 }, height: 20 }}
                        variant="outlined"
                    />
                </Stack>

                <Stack
                    alignItems="center"
                    direction="row"
                    gap={1.5}
                    sx={{ color: "text.secondary" }}
                >
                    <Stack alignItems="center" direction="row" gap={0.5}>
                        {machineWrite ? (
                            <SmartToyOutlinedIcon sx={{ fontSize: 14 }} />
                        ) : (
                            <PersonOutlineIcon sx={{ fontSize: 14 }} />
                        )}
                        <Typography variant="caption">
                            {entry.actorName ?? "מערכת"}
                        </Typography>
                    </Stack>
                    <Tooltip
                        title={dayjs(entry.changedAt).format(
                            "DD/MM/YYYY HH:mm:ss",
                        )}
                    >
                        <Stack alignItems="center" direction="row" gap={0.5}>
                            <ScheduleIcon sx={{ fontSize: 14 }} />
                            <Typography variant="caption">
                                {relativeTime(entry.changedAt)}
                            </Typography>
                        </Stack>
                    </Tooltip>
                </Stack>

                {entry.changes.length > 0 && (
                    <Stack
                        gap={0.5}
                        sx={{
                            bgcolor: "action.hover",
                            borderRadius: 1,
                            minWidth: 0,
                            px: 1,
                            py: 0.75,
                        }}
                    >
                        {entry.changes.map((change) => (
                            <ChangeRow
                                change={change}
                                key={change.field}
                                lookups={lookups}
                            />
                        ))}
                    </Stack>
                )}
            </Stack>
        </Stack>
    );
}

export function EventHistoryTimeline({
    entries,
    lookups,
}: EventHistoryTimelineProps) {
    return (
        <Stack sx={{ minWidth: 0 }}>
            {entries.map((entry, index) => (
                <TimelineEntry
                    entry={entry}
                    isLast={index === entries.length - 1}
                    key={entry.id}
                    lookups={lookups}
                />
            ))}
        </Stack>
    );
}
