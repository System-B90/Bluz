import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Link from "@mui/material/Link";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useCallback, useMemo, useState } from "react";

import { ShuffleDescriptions } from "@/api-shared/gantt/shuffle-names";
import {
    GanttEvent,
    GanttEventId,
    GanttModuleId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { formatHoursLabel } from "@/components/gantt/curriculum-view/gantt-time-utils";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/context";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";

/** The events sharing `groupId`, in the module's own order. */
export function useShuffleGroupMembers(
    event: GanttEvent | undefined,
    moduleId: GanttModuleId | null,
): Array<GanttEvent & { id: GanttEventId }> {
    const state = useCurriculumState();
    const groupId = event?.groupId ?? null;

    return useMemo(() => {
        if (!groupId || !moduleId) return [];
        return (state.modules[moduleId]?.events ?? [])
            .map((eventId) => state.events[eventId])
            .filter((member) => member?.groupId === groupId);
    }, [groupId, moduleId, state]);
}

/**
 * What applying `selected` does to the group, in the server's terms (see
 * `applyShuffleGroup`): fewer than two names only drops the group marker and
 * keeps every event, while a group of two or more deletes the members whose
 * shuffle was deselected. Null when there is nothing worth warning about.
 */
export function describeGroupChange(
    current: Set<string>,
    selected: Set<string>,
    memberCount: number,
): { destructive: boolean; text: string } | null {
    if (selected.size < 2) {
        if (memberCount < 2) return null;
        return {
            destructive: false,
            text: "הקבוצה תבוטל. המופעים יישארו כמופעים נפרדים, והזמן של כל אחד מהם ייספר בנפרד.",
        };
    }

    // An event that is not grouped yet is only ever reused, never deleted.
    if (memberCount < 2) return null;

    const dropped = [...current].filter((name) => !selected.has(name));
    const freed = selected.size - [...selected].filter((name) => current.has(name)).length;
    // A deselected shuffle's member is reused for a newly selected one when
    // there is one to take; only the rest are deleted.
    const deleted = Math.max(0, dropped.length - freed);
    if (deleted === 0) return null;
    return {
        destructive: true,
        text:
            deleted === 1
                ? "מופע אחד של שאפל שהוסר יימחק."
                : `${deleted} מופעים של שאפלים שהוסרו יימחקו.`,
    };
}

/**
 * Splits one event into a shuffle group: one event per selected shuffle, all
 * carrying the same name, so each shuffle can hold the lesson at its own time
 * (#699).
 *
 * The copies are separate rows on purpose — each keeps its own placement, cut
 * and Hive linkage — and the group only changes how they are counted: a
 * module's required time takes the longest member, not the sum of all of them.
 */
export function EventShuffleGroupField({
    event,
    eventId,
    moduleId,
    syllabusId,
    shuffleOptions,
    shuffleDescriptions = {},
}: {
    event: GanttEvent;
    eventId: GanttEventId;
    moduleId: GanttModuleId;
    syllabusId: GanttSyllabusId | null;
    /** Shuffle names defined on the parent syllabus. */
    shuffleOptions: Array<string>;
    /** The syllabus' shuffle name → description map. */
    shuffleDescriptions?: ShuffleDescriptions;
}) {
    const { enqueueSnackbar } = useSnackbar();
    const { applyEventShuffleGroup } = useModuleEventActions();
    const { openEventDialog } = useCurriculumProviderActions();
    const members = useShuffleGroupMembers(event, moduleId);

    const currentNames = useMemo(() => {
        const names = new Set<string>();
        for (const member of members) {
            for (const name of member.shuffles ?? []) names.add(name);
        }
        if (names.size === 0) {
            for (const name of event.shuffles ?? []) names.add(name);
        }
        return names;
    }, [members, event.shuffles]);

    const [selected, setSelected] = useState<Set<string>>(currentNames);
    const [isSaving, setIsSaving] = useState(false);

    const toggle = useCallback((name: string) => {
        setSelected((previous) => {
            const next = new Set(previous);
            if (next.has(name)) next.delete(name);
            else next.add(name);
            return next;
        });
    }, []);

    const applyHandler = useCallback(() => {
        setIsSaving(true);
        applyEventShuffleGroup(eventId, moduleId, [...selected])
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "פיצול המופע לשאפלים נכשל!",
                    error,
                ),
            )
            .finally(() => setIsSaving(false));
    }, [applyEventShuffleGroup, eventId, moduleId, selected, enqueueSnackbar]);

    if (shuffleOptions.length < 2) {
        return (
            <Typography color="text.secondary" variant="body2">
                כדי לפצל מופע לשאפלים יש להגדיר לפחות שני שאפלים במקצוע.
            </Typography>
        );
    }

    const isDirty =
        selected.size !== currentNames.size ||
        [...selected].some((name) => !currentNames.has(name));
    const consequence = describeGroupChange(currentNames, selected, members.length);

    return (
        <Stack spacing={1.5}>
            <Alert severity="info">
                כל שאפל שנבחר מקבל מופע משלו באותו שם. הזמנים והשיבוץ נפרדים לכל
                מופע, והזמן הנדרש של המערך נספר לפי השאפל הארוך ביותר — לא כסכום
                של כולם.
            </Alert>

            <Stack>
                {shuffleOptions.map((name) => (
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={selected.has(name)}
                                onChange={() => toggle(name)}
                                size="small"
                            />
                        }
                        key={name}
                        label={
                            <ListItemText
                                primary={name}
                                secondary={shuffleDescriptions[name]}
                            />
                        }
                    />
                ))}
            </Stack>

            {members.length > 0 ? (
                <Stack spacing={0.5}>
                    <Typography variant="subtitle2">מופעי הקבוצה</Typography>
                    {members.map((member) => (
                        <Stack
                            alignItems="center"
                            direction="row"
                            key={member.id}
                            spacing={1}
                        >
                            <Chip
                                label={(member.shuffles ?? []).join(", ") || "ללא שאפל"}
                                size="small"
                                variant="outlined"
                            />
                            <Typography color="text.secondary" variant="body2">
                                {formatHoursLabel(member.minimumDuration)}
                            </Typography>
                            {member.id === eventId ? (
                                <Typography color="text.secondary" variant="body2">
                                    (המופע הנוכחי)
                                </Typography>
                            ) : (
                                <Link
                                    component="button"
                                    onClick={() =>
                                        syllabusId &&
                                        openEventDialog(
                                            syllabusId,
                                            moduleId,
                                            member.id,
                                        )
                                    }
                                    type="button"
                                    variant="body2"
                                >
                                    פתיחה
                                </Link>
                            )}
                        </Stack>
                    ))}
                </Stack>
            ) : null}

            <Stack direction="row" spacing={1}>
                <Button
                    disabled={!isDirty || isSaving}
                    onClick={applyHandler}
                    variant="contained"
                >
                    {selected.size < 2 ? "ביטול הקבוצה" : "החלת הפיצול"}
                </Button>
                {isDirty && consequence ? (
                    <Typography
                        color={consequence.destructive ? "warning.main" : "text.secondary"}
                        sx={{ alignSelf: "center" }}
                        variant="caption"
                    >
                        {consequence.text}
                    </Typography>
                ) : null}
            </Stack>
        </Stack>
    );
}
