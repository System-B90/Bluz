import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CallSplitIcon from "@mui/icons-material/CallSplit";
import CloudSyncIcon from "@mui/icons-material/CloudSync";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import DragIndicatorIcon from "@mui/icons-material/DragIndicator";
import EditNoteIcon from "@mui/icons-material/EditNote";
import EventIcon from "@mui/icons-material/Event";
import HeightIcon from "@mui/icons-material/Height";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import HistoryIcon from "@mui/icons-material/History";
import KeyboardIcon from "@mui/icons-material/Keyboard";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";
import RestoreIcon from "@mui/icons-material/Restore";
import SelfImprovementIcon from "@mui/icons-material/SelfImprovement";
import SyncIcon from "@mui/icons-material/Sync";
import UndoIcon from "@mui/icons-material/Undo";
import { ReactElement } from "react";

import { EventChangeInitiator } from "@/api-shared/types/event-history";

/**
 * Visual vocabulary for the event change log: every initiator gets its own
 * icon and palette slot so a row is recognizable before it is read. Machine
 * (gantt) writes sit on the primary colour, human edits on secondary, and
 * anything unattributed is greyed out.
 */

export type InitiatorPresentation = {
    icon: ReactElement;
    /** Theme palette key used for the timeline marker. */
    color: "info" | "primary" | "secondary" | "success" | "warning";
};

const PRESENTATION: Record<EventChangeInitiator, InitiatorPresentation> = {
    [EventChangeInitiator.GanttCut]: {
        color: "primary",
        icon: <ContentCutIcon fontSize="small" />,
    },
    [EventChangeInitiator.GanttReload]: {
        color: "primary",
        icon: <SyncIcon fontSize="small" />,
    },
    [EventChangeInitiator.GanttPullBack]: {
        color: "warning",
        icon: <UndoIcon fontSize="small" />,
    },
    [EventChangeInitiator.EventDialog]: {
        color: "secondary",
        icon: <EditNoteIcon fontSize="small" />,
    },
    [EventChangeInitiator.DragDrop]: {
        color: "secondary",
        icon: <DragIndicatorIcon fontSize="small" />,
    },
    [EventChangeInitiator.Resize]: {
        color: "secondary",
        icon: <HeightIcon fontSize="small" />,
    },
    [EventChangeInitiator.CopyPaste]: {
        color: "secondary",
        icon: <ContentCopyIcon fontSize="small" />,
    },
    [EventChangeInitiator.InstructorAssign]: {
        color: "secondary",
        icon: <PersonAddAlt1Icon fontSize="small" />,
    },
    [EventChangeInitiator.Keyboard]: {
        color: "secondary",
        icon: <KeyboardIcon fontSize="small" />,
    },
    [EventChangeInitiator.OfflinePush]: {
        color: "info",
        icon: <CloudSyncIcon fontSize="small" />,
    },
    [EventChangeInitiator.SnapshotRestore]: {
        color: "info",
        icon: <RestoreIcon fontSize="small" />,
    },
    [EventChangeInitiator.GoogleSync]: {
        color: "info",
        icon: <EventIcon fontSize="small" />,
    },
    [EventChangeInitiator.PrayerSettings]: {
        color: "info",
        icon: <SelfImprovementIcon fontSize="small" />,
    },
    [EventChangeInitiator.Split]: {
        color: "secondary",
        icon: <CallSplitIcon fontSize="small" />,
    },
    [EventChangeInitiator.Undo]: {
        color: "secondary",
        icon: <HistoryIcon fontSize="small" />,
    },
    [EventChangeInitiator.AiAssistant]: {
        color: "info",
        icon: <AutoAwesomeIcon fontSize="small" />,
    },
    [EventChangeInitiator.Unknown]: {
        color: "info",
        icon: <HelpOutlineIcon fontSize="small" />,
    },
};

/**
 * Icon + colour for an initiator, falling back to a neutral "unknown" marker
 * so a value added server-side still renders.
 * @param initiator The recorded initiator of a change.
 */
export function presentationFor(
    initiator: EventChangeInitiator,
): InitiatorPresentation {
    return PRESENTATION[initiator] ?? PRESENTATION[EventChangeInitiator.Unknown];
}

/** Icon marking what kind of write a row describes. */
export const ACTION_ICONS = {
    archived: <DeleteOutlineIcon fontSize="inherit" />,
    created: <AddCircleOutlineIcon fontSize="inherit" />,
    updated: <EditNoteIcon fontSize="inherit" />,
} as const;
