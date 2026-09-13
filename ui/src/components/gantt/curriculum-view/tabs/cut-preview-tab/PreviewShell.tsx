"use client";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import CircularProgress from "@mui/material/CircularProgress";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import { ReactNode } from "react";

import { CutValidationError } from "@/api-shared/gantt/cut-planner";
import { CALENDAR_MESSAGES } from "@/components/CalendarMessages";
import { CutPreviewState } from "@/components/gantt/curriculum-view/tabs/cut-preview-tab/UseCutPreview";

/** Uniform sizing for every toolbar button group across the preview tabs. */
export const PREVIEW_BUTTON_GROUP_SX = {
    "& .MuiButton-root": { height: 32 },
} as const;

/**
 * Compact status badge Alerts in the preview toolbar. Alert's default icon
 * padding (7px 0) and message padding (8px 0) are tuned for its default
 * root padding — squashing the root to `py: 0` without also centering
 * leaves the icon glyph pinned to the top while the text sits below it.
 */
export const PREVIEW_STATUS_ALERT_SX = {
    alignItems: "center",
    py: 0,
    "& .MuiAlert-icon": { py: 0 },
    "& .MuiAlert-message": { py: 0.5 },
} as const;

function describeValidationError(error: CutValidationError): string {
    switch (error.type) {
    case "missing-start-date":
        return "לתוכנית הלימודים אין תאריך התחלה — קבעו תאריך התחלה כדי לראות תצוגה מקדימה";
    case "unmapped-event":
        return `האירוע "${error.title}" אינו משובץ ליום כלשהו`;
    case "unsatisfied-recurrence":
        return `לאירוע המחזורי "${error.title}" אין שיבוץ פתיחה בשבוע הראשון`;
    }
}

export function PreviewValidationErrors({
    errors,
}: {
    errors: Array<CutValidationError>;
}) {
    return (
        <Stack gap={1} sx={{ p: 2 }}>
            <Alert severity="warning" sx={{ alignItems: "center" }}>
                לא ניתן להציג תצוגה מקדימה — נמצאו בעיות בתוכנית:
            </Alert>
            <List dense disablePadding>
                {errors.map((error) => (
                    <ListItem
                        disableGutters
                        key={
                            "eventId" in error
                                ? `${error.type}:${error.eventId}`
                                : error.type
                        }
                    >
                        <ListItemText primary={describeValidationError(error)} />
                    </ListItem>
                ))}
            </List>
        </Stack>
    );
}

export function PreviewLoading() {
    return (
        <Box
            alignItems="center"
            display="flex"
            height="100%"
            justifyContent="center"
            width="100%"
        >
            <CircularProgress size={28} />
        </Box>
    );
}

/**
 * Renders the non-ready states of a cut preview (loading, request error,
 * validation failure). Returns null when the preview holds usable data, so a
 * tab can `if (blocked) return blocked;` before rendering its own body.
 */
export function renderPreviewBlockers(
    preview: CutPreviewState,
): null | ReactNode {
    if (preview.kind === "loading") return <PreviewLoading />;
    if (preview.kind === "error") {
        return (
            <Alert severity="error" sx={{ m: 2 }}>
                {preview.message}
            </Alert>
        );
    }
    if (!preview.data.ok) {
        return <PreviewValidationErrors errors={preview.data.errors} />;
    }
    return null;
}

/**
 * Prev / "start of the gantt" / next stepper shared by the preview tabs.
 * The caller owns the anchor state and decides how far a step moves.
 */
export function PreviewNavigation({
    onNavigate,
}: {
    onNavigate: (direction: "next" | "prev" | "start") => void;
}) {
    return (
        <ButtonGroup
            size="small"
            sx={PREVIEW_BUTTON_GROUP_SX}
            variant="outlined"
        >
            <Button onClick={() => onNavigate("prev")}>
                {CALENDAR_MESSAGES.previous}
            </Button>
            <Button onClick={() => onNavigate("start")}>תחילת הגאנט</Button>
            <Button onClick={() => onNavigate("next")}>
                {CALENDAR_MESSAGES.next}
            </Button>
        </ButtonGroup>
    );
}

/** The toolbar strip above a preview body: navigation, title, extra controls. */
export function PreviewToolbar({
    onNavigate,
    title,
    children,
}: {
    onNavigate: (direction: "next" | "prev" | "start") => void;
    title: ReactNode;
    children?: ReactNode;
}) {
    return (
        <Box
            alignItems="center"
            display="flex"
            flexWrap="wrap"
            gap={1.5}
            justifyContent="space-between"
            pb={1}
        >
            <PreviewNavigation onNavigate={onNavigate} />
            {title}
            {children}
        </Box>
    );
}

/** Full-height column layout every preview tab uses as its outer container. */
export function PreviewLayout({ children }: { children: ReactNode }) {
    return (
        <Box display="flex" flexDirection="column" height="100%" minHeight={0}>
            {children}
        </Box>
    );
}
