import AddIcon from "@mui/icons-material/Add";
import CloudDownloadOutlinedIcon from "@mui/icons-material/CloudDownloadOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ganttApi } from "@/api-client/gantt";
import { apiGetClasses } from "@/api-client/hive";
import {
    normalizeShuffleDescriptions,
    normalizeShuffleName,
    SHUFFLE_DESCRIPTION_MAX_LENGTH,
    ShuffleDescriptions,
} from "@/api-shared/gantt/shuffle-names";
import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { ShuffleUsages } from "@/api-shared/types/gantt/shuffles";
import { Class } from "@/api-shared/types/hive";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import {
    useCurriculumProviderActions,
    useCurriculumState,
} from "@/components/gantt/state/context";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";
import { ShuffleDeleteDialog } from "@/components/gantt/syllabus-dialog/ShuffleDeleteDialog";

const NO_USAGES: ShuffleUsages = { events: [], modules: [] };
const NO_DESCRIPTIONS: ShuffleDescriptions = {};
// Shared input name: the browser keys its saved autocomplete entries on it,
// so every description field offers what was typed in any dialog before.
const SHUFFLE_DESCRIPTION_AUTOCOMPLETE = "shuffle-description";

export type ShufflesSectionProps = {
    syllabusId: GanttSyllabusId | null;
};

type PendingDeletion = {
    removed: Array<string>;
    shuffles: Array<string>;
    usages: ShuffleUsages;
};

/** The usage chip's label: how many modules and events carry the shuffle. */
export function shuffleUsageLabel(count: number): string {
    if (count === 0) return "לא בשימוש";
    if (count === 1) return "מערך/מופע אחד";
    return `${count} מערכים/מופעים`;
}

/** A Hive group's description, trimmed to what a shuffle may hold. */
function hiveDescription(group: Class | undefined): string {
    return (group?.description ?? "")
        .trim()
        .slice(0, SHUFFLE_DESCRIPTION_MAX_LENGTH);
}

/**
 * Hive student groups, keyed by normalized name. A shuffle is 1:1 with a Hive
 * student group matched by name (see `resolveDesiredRules`), so this tells a
 * shuffle whether it is linked and what its Hive description is. `null` while
 * loading or when Hive is unreachable: the section still works offline.
 */
function useHiveStudentGroups(): Map<string, Class> | null {
    const [groups, setGroups] = useState<Map<string, Class> | null>(null);

    useEffect(() => {
        let cancelled = false;
        apiGetClasses()
            .then((fetched) => {
                if (cancelled) return;
                setGroups(
                    new Map(
                        fetched.map((group) => [
                            normalizeShuffleName(group.name),
                            group,
                        ]),
                    ),
                );
            })
            .catch(() => {
                if (!cancelled) setGroups(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return groups;
}

/** How many of the syllabus' modules and events carry each shuffle name. */
function useShuffleTagCounts(syllabusId: GanttSyllabusId | null) {
    const state = useCurriculumState();

    return useMemo(() => {
        const counts: Record<string, number> = {};
        const bump = (names: Array<string> | undefined) => {
            for (const name of names ?? []) {
                counts[name] = (counts[name] ?? 0) + 1;
            }
        };

        if (!syllabusId) return counts;
        for (const moduleId of state.syllabuses[syllabusId]?.modules ?? []) {
            const moduleDoc = state.modules[moduleId];
            if (!moduleDoc) continue;
            bump(moduleDoc.shuffles);
            for (const eventId of moduleDoc.events ?? []) {
                bump(state.events[eventId]?.shuffles);
            }
        }
        return counts;
    }, [syllabusId, state]);
}

/** Whether a shuffle has a same-named Hive student group to sync against. */
function HiveLinkChip({ group }: { group: Class | undefined }) {
    if (group) {
        return (
            <Tooltip title={group.display_name}>
                <Chip
                    color="success"
                    label="Hive"
                    size="small"
                    variant="outlined"
                />
            </Tooltip>
        );
    }
    return (
        <Tooltip title="אין קבוצת תלמידים ב-Hive בשם הזה, ולכן השאפל לא יסונכרן לשיעורים">
            <Chip
                color="warning"
                label="לא ב-Hive"
                size="small"
                variant="outlined"
            />
        </Tooltip>
    );
}

/**
 * One shuffle's description, edited in place and committed on blur so each
 * keystroke is not a PATCH. Keyed by its stored value, so an outside change
 * (e.g. a Hive import) remounts it with the new text.
 */
function ShuffleDescriptionField({
    name,
    onCommit,
    value,
}: {
    name: string;
    onCommit: (description: string) => void;
    value: string;
}) {
    const [draft, setDraft] = useState(value);

    return (
        <TextField
            autoComplete="on"
            fullWidth
            name={SHUFFLE_DESCRIPTION_AUTOCOMPLETE}
            onBlur={() => {
                if (draft.trim() !== value) onCommit(draft);
            }}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="תיאור (גלוי לסגל בלבד)"
            size="small"
            slotProps={{
                htmlInput: {
                    "aria-label": `תיאור השאפל ${name}`,
                    maxLength: SHUFFLE_DESCRIPTION_MAX_LENGTH,
                },
            }}
            value={draft}
            variant="standard"
        />
    );
}

/**
 * The syllabus' shuffles (student groups), a section of the syllabus dialog
 * (#699, folded into the single dialog in #7xx).
 *
 * Shuffles stay per-syllabus: the names defined here are what the module and
 * event dialogs offer as tags, and what an event's shuffle group splits across.
 * Deleting a name that modules or events still use goes through a confirmation
 * that lists them and cascades the removal (#485) — otherwise those items keep
 * a dangling name the UI cannot clear.
 *
 * Each shuffle is a Hive student group: names are offered from Hive, the
 * description mirrors the group's staff-only description, and a chip shows
 * whether a same-named group exists (the lesson sync skips shuffles without
 * one).
 */
export function ShufflesSection({ syllabusId }: ShufflesSectionProps) {
    const { enqueueSnackbar } = useSnackbar();
    const syllabus = useSyllabus(syllabusId as GanttSyllabusId);
    const { updateSyllabus } = useSyllabusActions();
    const { dispatch } = useCurriculumProviderActions();
    const tagCounts = useShuffleTagCounts(syllabusId);
    const hiveGroups = useHiveStudentGroups();

    const [draft, setDraft] = useState("");
    const [draftDescription, setDraftDescription] = useState("");
    const [pending, setPending] = useState<null | PendingDeletion>(null);
    // The shuffle whose usages are being fetched: a second click on its delete
    // button would otherwise open the confirmation twice.
    const [checking, setChecking] = useState<null | string>(null);

    const shuffles = useMemo(
        () => syllabus?.shuffles ?? [],
        [syllabus?.shuffles],
    );
    const descriptions = syllabus?.shuffleDescriptions ?? NO_DESCRIPTIONS;

    const hiveOptions = useMemo(
        () =>
            [...(hiveGroups?.values() ?? [])].filter(
                (group) => !shuffles.includes(normalizeShuffleName(group.name)),
            ),
        [hiveGroups, shuffles],
    );

    // Linked shuffles whose Bluz description differs from Hive's non-empty one.
    const importable = useMemo(
        () =>
            shuffles.filter((name) => {
                const fromHive = hiveDescription(hiveGroups?.get(name));
                return fromHive !== "" && fromHive !== (descriptions[name] ?? "");
            }),
        [shuffles, hiveGroups, descriptions],
    );

    const commit = useCallback(
        (next: Array<string>, nextDescriptions: ShuffleDescriptions) => {
            if (!syllabusId) return;
            updateSyllabus(syllabusId, {
                shuffles: next,
                shuffleDescriptions: normalizeShuffleDescriptions(
                    nextDescriptions,
                    next,
                ),
            }).catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון השאפלים נכשל!",
                    error,
                ),
            );
        },
        [syllabusId, updateSyllabus, enqueueSnackbar],
    );

    const addHandler = useCallback(() => {
        const name = normalizeShuffleName(draft);
        if (!name) return;
        if (
            shuffles.some((shuffle) => normalizeShuffleName(shuffle) === name)
        ) {
            enqueueSnackbar("שאפל בשם הזה כבר קיים במקצוע.", {
                variant: "warning",
            });
            return;
        }

        const description =
            draftDescription.trim() || hiveDescription(hiveGroups?.get(name));
        setDraft("");
        setDraftDescription("");
        commit([...shuffles, name], { ...descriptions, [name]: description });
    }, [
        draft,
        draftDescription,
        shuffles,
        descriptions,
        hiveGroups,
        commit,
        enqueueSnackbar,
    ]);

    const describeHandler = useCallback(
        (name: string, description: string) =>
            commit(shuffles, { ...descriptions, [name]: description }),
        [shuffles, descriptions, commit],
    );

    const importDescriptionsHandler = useCallback(() => {
        const next = { ...descriptions };
        for (const name of importable) {
            next[name] = hiveDescription(hiveGroups?.get(name));
        }
        commit(shuffles, next);
    }, [importable, descriptions, hiveGroups, shuffles, commit]);

    const removeHandler = useCallback(
        (name: string) => {
            if (!syllabusId || checking) return;
            const next = shuffles.filter((shuffle) => shuffle !== name);

            setChecking(name);
            ganttApi
                .getShuffleUsages(syllabusId, [name])
                .then((usages) => {
                    if (usages.modules.length + usages.events.length > 0) {
                        setPending({
                            removed: [name],
                            shuffles: next,
                            usages,
                        });
                        return;
                    }
                    commit(next, descriptions);
                })
                .catch((error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "בדיקת השימוש בשאפל נכשלה!",
                        error,
                    ),
                )
                .finally(() => setChecking(null));
        },
        [syllabusId, checking, shuffles, descriptions, commit, enqueueSnackbar],
    );

    const confirmDeletionHandler = useCallback(() => {
        if (!pending || !syllabusId) return;
        const { removed, shuffles: next, usages } = pending;
        setPending(null);

        const strip = (names: Array<string>) =>
            names.filter((name) => !removed.includes(name));

        ganttApi
            .applyShuffles(syllabusId, next)
            .then(() => {
                // The server stripped the names in the same transaction, so
                // mirror it locally instead of refetching the whole gantt.
                for (const usedModule of usages.modules) {
                    dispatch({
                        type: "UPDATE_MODULE",
                        payload: {
                            id: usedModule.id,
                            updates: { shuffles: strip(usedModule.shuffles) },
                        },
                    });
                }
                for (const event of usages.events) {
                    dispatch({
                        type: "UPDATE_EVENT",
                        payload: {
                            id: event.id,
                            updates: { shuffles: strip(event.shuffles) },
                        },
                    });
                }
                dispatch({
                    type: "UPDATE_SYLLABUS",
                    payload: {
                        id: syllabusId,
                        updates: {
                            shuffles: next,
                            shuffleDescriptions: normalizeShuffleDescriptions(
                                descriptions,
                                next,
                            ),
                        },
                    },
                });
            })
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "מחיקת השאפלים נכשלה!",
                    error,
                ),
            );
    }, [pending, syllabusId, descriptions, dispatch, enqueueSnackbar]);

    return (
        <Stack gap={1.5}>
            <Alert severity="info">
                השאפלים שייכים למקצוע. מערכים ומופעים מתויגים בשאפלים האלה,
                ומופע יחיד יכול להתפצל לקבוצה — מופע לכל שאפל, באותו שם ובזמנים
                שונים. כל שאפל הוא קבוצת תלמידים ב-Hive באותו שם.
            </Alert>

            <Stack alignItems="flex-start" direction="row" gap={1}>
                <Autocomplete
                    freeSolo
                    fullWidth
                    getOptionLabel={(option) =>
                        typeof option === "string" ? option : option.name
                    }
                    inputValue={draft}
                    onChange={(_, option) => {
                        if (!option || typeof option === "string") return;
                        setDraft(option.name);
                        setDraftDescription(hiveDescription(option));
                    }}
                    onInputChange={(_, value) => setDraft(value)}
                    options={hiveOptions}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="שם השאפל"
                            onKeyDown={(e) => {
                                if (e.key !== "Enter" || !draft.trim()) return;
                                e.preventDefault();
                                addHandler();
                            }}
                        />
                    )}
                    renderOption={({ key, ...props }, option) => (
                        <li key={key} {...props}>
                            <ListItemText
                                primary={option.name}
                                secondary={
                                    option.description || option.program__name
                                }
                            />
                        </li>
                    )}
                    size="small"
                />
                <TextField
                    autoComplete="on"
                    fullWidth
                    label="תיאור"
                    name={SHUFFLE_DESCRIPTION_AUTOCOMPLETE}
                    onChange={(e) => setDraftDescription(e.target.value)}
                    size="small"
                    slotProps={{
                        htmlInput: { maxLength: SHUFFLE_DESCRIPTION_MAX_LENGTH },
                    }}
                    value={draftDescription}
                />
                <Button
                    disabled={!draft.trim()}
                    onClick={addHandler}
                    startIcon={<AddIcon fontSize="small" />}
                    sx={{ flexShrink: 0, mt: 0.25 }}
                    variant="contained"
                >
                    הוספה
                </Button>
            </Stack>

            {importable.length > 0 && (
                <Button
                    onClick={importDescriptionsHandler}
                    size="small"
                    startIcon={<CloudDownloadOutlinedIcon fontSize="small" />}
                    sx={{ alignSelf: "flex-start" }}
                >
                    {`ייבוא תיאורים מ-Hive (${importable.length})`}
                </Button>
            )}

            {shuffles.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                    לא הוגדרו שאפלים במקצוע.
                </Typography>
            ) : (
                <List dense disablePadding>
                    {shuffles.map((name) => (
                        <ListItem
                            disableGutters
                            key={name}
                            secondaryAction={
                                <Tooltip title="מחיקת שאפל">
                                    {/* A disabled button fires no events, so the tooltip hangs off a wrapper. */}
                                    <span>
                                        <IconButton
                                            aria-label={`מחיקת השאפל ${name}`}
                                            color="error"
                                            disabled={checking !== null}
                                            edge="end"
                                            onClick={() => removeHandler(name)}
                                            size="small"
                                        >
                                            <DeleteOutlineIcon fontSize="small" />
                                        </IconButton>
                                    </span>
                                </Tooltip>
                            }
                            sx={{ paddingInlineEnd: 6 }}
                        >
                            <Stack flex={1} gap={0.5} minWidth={0}>
                                <Stack
                                    alignItems="center"
                                    direction="row"
                                    gap={1}
                                >
                                    <Typography variant="body2">
                                        {name}
                                    </Typography>
                                    {hiveGroups !== null && (
                                        <HiveLinkChip
                                            group={hiveGroups.get(name)}
                                        />
                                    )}
                                    <Chip
                                        label={shuffleUsageLabel(
                                            tagCounts[name] ?? 0,
                                        )}
                                        size="small"
                                        variant="outlined"
                                    />
                                </Stack>
                                <ShuffleDescriptionField
                                    key={descriptions[name] ?? ""}
                                    name={name}
                                    onCommit={(description) =>
                                        describeHandler(name, description)
                                    }
                                    value={descriptions[name] ?? ""}
                                />
                            </Stack>
                        </ListItem>
                    ))}
                </List>
            )}

            <ShuffleDeleteDialog
                onCancel={() => setPending(null)}
                onConfirm={confirmDeletionHandler}
                open={pending !== null}
                removed={pending?.removed ?? []}
                usages={pending?.usages ?? NO_USAGES}
            />
        </Stack>
    );
}
