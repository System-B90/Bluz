import StickyNote2Outlined from "@mui/icons-material/StickyNote2Outlined";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";

/** Longest note shown in the hover tooltip; the full text stays in the event dialog. */
export const EVENT_NOTE_PREVIEW_MAX = 400;

/**
 * The note text worth previewing, or null when the event has no real note.
 * @param comment The event's `comment` field.
 */
export function eventNotePreview(comment: null | string | undefined): null | string {
    const trimmed = comment?.trim();
    if (!trimmed) return null;
    return trimmed.length > EVENT_NOTE_PREVIEW_MAX
        ? `${trimmed.slice(0, EVENT_NOTE_PREVIEW_MAX)}…`
        : trimmed;
}

/**
 * Small note icon beside a gantt event title. Hovering shows the note, so the
 * user sees it without opening the edit dialog (#773). Renders nothing for an
 * event without a note.
 */
export function EventNoteIndicator({ comment }: { comment: null | string | undefined }) {
    const preview = eventNotePreview(comment);
    if (!preview) return null;

    return (
        <Tooltip
            arrow
            title={ (
                <Typography sx={ { whiteSpace: "pre-wrap" } } variant="body2">
                    { preview }
                </Typography>
            ) }
        >
            <StickyNote2Outlined
                aria-label="הערות המופע"
                color="action"
                data-testid="event-note-indicator"
                role="img"
                sx={ { flexShrink: 0, fontSize: 16, marginInlineStart: 0.5 } }
                tabIndex={ 0 }
            />
        </Tooltip>
    );
}
