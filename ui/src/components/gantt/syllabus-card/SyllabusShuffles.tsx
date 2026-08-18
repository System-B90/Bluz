import GroupsIcon from "@mui/icons-material/Groups";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import { useSnackbar } from "notistack";
import { useCallback, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { ganttApi } from "@/api-client/gantt";
import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { ShuffleUsages } from "@/api-shared/types/gantt/shuffles";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";
import { useCurriculumProviderActions } from "@/components/gantt/state/provider";
import { ShuffleDeleteDialog } from "@/components/gantt/syllabus-card/ShuffleDeleteDialog";

const NO_USAGES: ShuffleUsages = { events: [], modules: [] };

type PendingDeletion = {
    removed: Array<string>;
    shuffles: Array<string>;
    usages: ShuffleUsages;
};

/**
 * Free-text chips editor for the syllabus' shuffle (student group) names.
 * Modules and events can then be tagged with a subset of these names.
 *
 * Deleting a name that modules or events still use goes through a confirmation
 * dialog that lists them and cascades the removal (#485) — otherwise those
 * items keep a dangling name the UI cannot clear.
 */
export function SyllabusShuffles({
    syllabusId,
    isHovered,
}: {
    syllabusId: GanttSyllabusId;
    isHovered: boolean;
})
{
    const { enqueueSnackbar } = useSnackbar();
    const syllabus = useSyllabus(syllabusId);
    const { updateSyllabus } = useSyllabusActions();
    const { dispatch } = useCurriculumProviderActions();
    const [pending, setPending] = useState<null | PendingDeletion>(null);

    const handleChange = useCallback(
        (_: unknown, value: Array<string>) =>
        {
            const shuffles = Array.from(
                new Set(value.map((v) => v.trim()).filter(Boolean)),
            );
            const kept = new Set(shuffles);
            const removed = (syllabus?.shuffles ?? []).filter(
                (name) => !kept.has(name),
            );

            const run = async () =>
            {
                const usages = removed.length
                    ? await ganttApi.getShuffleUsages(syllabusId, removed)
                    : NO_USAGES;

                if (usages.modules.length + usages.events.length > 0) {
                    setPending({ removed, shuffles, usages });
                    return;
                }

                await updateSyllabus(syllabusId, { shuffles });
            };

            run().catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "עדכון השאפלים נכשל!",
                    error,
                ),
            );
        },
        [ syllabusId, syllabus?.shuffles, updateSyllabus, enqueueSnackbar ],
    );

    const handleConfirmDeletion = useCallback(
        () =>
        {
            if (!pending) return;
            const { removed, shuffles, usages } = pending;
            setPending(null);

            const strip = (names: Array<string>) =>
                names.filter((name) => !removed.includes(name));

            ganttApi
                .applyShuffles(syllabusId, shuffles)
                .then(() =>
                {
                    // The server stripped the names in the same transaction, so
                    // mirror it locally instead of refetching the whole gantt.
                    for (const usedModule of usages.modules) {
                        dispatch({
                            type: "UPDATE_MODULE",
                            payload: {
                                id: usedModule.id,
                                updates: {
                                    shuffles: strip(usedModule.shuffles),
                                },
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
                        payload: { id: syllabusId, updates: { shuffles } },
                    });
                })
                .catch((error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "מחיקת השאפלים נכשלה!",
                        error,
                    ),
                );
        },
        [ pending, syllabusId, dispatch, enqueueSnackbar ],
    );

    if (!syllabus) return null;

    return (
        <Box
            alignItems="center"
            display="flex"
            flexDirection="row"
            gap={ 1 }
            px={ 2 }
            py={ 0.5 }
            width='100%'
        >
            <Tooltip title="שאפלים במקצוע">
                <GroupsIcon color="action" fontSize="small" />
            </Tooltip>
            <Box flexGrow={ 1 } minWidth={ 0 }>
                <Box
                    overflow="hidden"
                    sx={ {
                        maxWidth: isHovered ? '100%' : 0,
                        transition: (theme) => theme.transitions.create('max-width', {
                            duration: theme.transitions.duration.shorter,
                        }),
                    } }
                >
                    <Autocomplete
                        freeSolo
                        fullWidth
                        multiple
                        onChange={ handleChange }
                        options={ [] }
                        renderInput={ (params) => (
                            <TextField
                                { ...params }
                                placeholder={
                                    (syllabus.shuffles ?? []).length === 0
                                        ? "הוספת שאפל (Enter להוספה)"
                                        : undefined
                                }
                                size="small"
                                variant="standard"
                            />
                        ) }
                        size="small"
                        value={ syllabus.shuffles ?? [] }
                    />
                </Box>
            </Box>
            <ShuffleDeleteDialog
                onCancel={ () => setPending(null) }
                onConfirm={ handleConfirmDeletion }
                open={ pending !== null }
                removed={ pending?.removed ?? [] }
                usages={ pending?.usages ?? NO_USAGES }
            />
        </Box>
    );
}
