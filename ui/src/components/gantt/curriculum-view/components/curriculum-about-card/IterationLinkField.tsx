import LinkIcon from "@mui/icons-material/Link";
import LinkOffIcon from "@mui/icons-material/LinkOff";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { apiListIterations, apiPatchIteration } from "@/api-client/iterations";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { Iteration, IterationId } from "@/api-shared/types/iteration";
import { EditableCurriculumField } from "@/components/gantt/curriculum-view/components/curriculum-about-card/EditableCurriculumField";

export type IterationLinkFieldProps = {
    curriculumId: GanttCurriculumId | null;
};

/**
 * Lets the user link the curriculum to a schedule iteration — required before
 * "גזירה ללו"ז" (cut to schedule) can succeed, since the cut endpoint resolves
 * its target database via the iteration's `ganttCurriculumId`.
 */
export function IterationLinkField({ curriculumId }: IterationLinkFieldProps) {
    const { enqueueSnackbar } = useSnackbar();
    const [iterations, setIterations] = useState<Array<Iteration> | null>(
        null,
    );
    const [isLinking, setIsLinking] = useState(false);
    const [isUnlinking, setIsUnlinking] = useState(false);

    const loadIterations = useCallback(() => {
        apiListIterations()
            .then(setIterations)
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת המחזורים נכשלה.",
                    error,
                ),
            );
    }, [enqueueSnackbar]);

    useEffect(() => {
        loadIterations();
    }, [loadIterations]);

    const linkedIteration = useMemo(
        () =>
            iterations?.find(
                (iteration) => iteration.ganttCurriculumId === curriculumId,
            ),
        [iterations, curriculumId],
    );

    const availableIterations = useMemo(
        () => (iterations ?? []).filter((iteration) => !iteration.ganttCurriculumId),
        [iterations],
    );

    const currentIteration = useMemo(
        () => iterations?.find((iteration) => iteration.isCurrent),
        [iterations],
    );

    const [isOverriding, setIsOverriding] = useState(false);

    const handleOverride = useCallback(() => {
        if (!curriculumId || !currentIteration) {
            return;
        }
        setIsOverriding(true);
        apiPatchIteration(currentIteration.id, {
            ganttCurriculumId: curriculumId,
        })
            .then(() => loadIterations())
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "קישור המחזור הנוכחי נכשל.",
                    error,
                ),
            )
            .finally(() => setIsOverriding(false));
    }, [curriculumId, currentIteration, enqueueSnackbar, loadIterations]);

    const handleLink = useCallback(
        (iterationId: IterationId) => {
            if (!curriculumId || !iterationId) {
                return;
            }
            setIsLinking(true);
            apiPatchIteration(iterationId, {
                ganttCurriculumId: curriculumId,
            })
                .then(() => loadIterations())
                .catch((error) =>
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "קישור המחזור לתוכנית הלימודים נכשל.",
                        error,
                    ),
                )
                .finally(() => setIsLinking(false));
        },
        [curriculumId, enqueueSnackbar, loadIterations],
    );

    const handleUnlink = useCallback(() => {
        if (!linkedIteration) {
            return;
        }
        setIsUnlinking(true);
        apiPatchIteration(linkedIteration.id, { ganttCurriculumId: null })
            .then(() => loadIterations())
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "ניתוק המחזור מתוכנית הלימודים נכשל.",
                    error,
                ),
            )
            .finally(() => setIsUnlinking(false));
    }, [linkedIteration, enqueueSnackbar, loadIterations]);

    const saveLabelHandler = useCallback(
        async (nextLabel: string) => {
            if (!linkedIteration) {
                return;
            }
            await apiPatchIteration(linkedIteration.id, {
                label: nextLabel,
            }).catch((error) => {
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "שינוי שם המחזור נכשל.",
                    error,
                );
                throw error;
            });
            loadIterations();
        },
        [linkedIteration, enqueueSnackbar, loadIterations],
    );

    if (!curriculumId) {
        return null;
    }

    return (
        <Box display="flex" flexDirection="column" gap={0.5}>
            <Typography color="textSecondary" variant="body2">
                מחזור מקושר:
            </Typography>
            {iterations === null ? (
                <Skeleton height={32} variant="rounded" width="70%" />
            ) : linkedIteration ? (
                <Box alignItems="center" display="flex" gap={0.5}>
                    <Box flexGrow={1}>
                        <EditableCurriculumField
                            allowEmpty={false}
                            canEdit
                            editTooltip="שינוי שם המחזור"
                            onSave={saveLabelHandler}
                            renderDisplay={(value) => (
                                <Typography variant="body2">
                                    {value}
                                </Typography>
                            )}
                            skeletonWidth="70%"
                            value={linkedIteration.label}
                        />
                    </Box>
                    {linkedIteration.isCurrent ? <Chip color="primary" label="נוכחי" size="small" /> : null}
                    <Tooltip title="ניתוק המחזור מתוכנית הלימודים">
                        <span>
                            <IconButton
                                disabled={isUnlinking}
                                onClick={handleUnlink}
                                size="small"
                            >
                                {isUnlinking ? (
                                    <CircularProgress
                                        color="inherit"
                                        size={20}
                                    />
                                ) : (
                                    <LinkOffIcon fontSize="small" />
                                )}
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
            ) : availableIterations.length > 0 ? (
                <Autocomplete
                    disableClearable
                    disabled={isLinking}
                    getOptionLabel={(iteration) => iteration.label}
                    loading={isLinking}
                    onChange={(_event, iteration) =>
                        iteration && handleLink(iteration.id)
                    }
                    options={availableIterations}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            placeholder="בחר מחזור לקישור..."
                            slotProps={{
                                input: {
                                    ...params.InputProps,
                                    endAdornment: isLinking ? (
                                        <CircularProgress
                                            color="inherit"
                                            size={16}
                                        />
                                    ) : (
                                        <LinkIcon
                                            color="disabled"
                                            fontSize="small"
                                        />
                                    ),
                                },
                            }}
                        />
                    )}
                    size="small"
                    value={undefined}
                />
            ) : currentIteration ? (
                <Box alignItems="center" display="flex" gap={0.5}>
                    <Typography color="textSecondary" sx={{ flexGrow: 1 }} variant="body2">
                        המחזור הנוכחי ({currentIteration.label}) מקושר לתוכנית לימודים אחרת
                    </Typography>
                    <Tooltip title="קישור המחזור הנוכחי לתוכנית לימודים זו, במקום הקישור הקיים שלו">
                        <span>
                            <IconButton
                                disabled={isOverriding}
                                onClick={handleOverride}
                                size="small"
                            >
                                {isOverriding ? (
                                    <CircularProgress
                                        color="inherit"
                                        size={20}
                                    />
                                ) : (
                                    <LinkIcon color="warning" fontSize="small" />
                                )}
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
            ) : (
                <Typography color="textSecondary" variant="body2">
                    אין מחזורים זמינים לקישור
                </Typography>
            )}
        </Box>
    );
}
