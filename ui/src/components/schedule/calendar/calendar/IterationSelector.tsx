"use client";

import HistoryIcon from "@mui/icons-material/History";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import { useSnackbar } from "notistack";
import { useCallback, useEffect, useState } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { apiListIterations } from "@/api-client/iterations";
import { Iteration } from "@/api-shared/types/iteration";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";

const CURRENT_VALUE = "__current__";

/**
 * Lets the user switch the calendar between the current run and past iterations.
 * Past iterations are read-only reference material. Hidden until more than one
 * iteration is registered, so single-iteration deployments are unaffected.
 */
export function IterationSelector() {
    const { iterationId, setIterationId, isReadOnlyIteration } = useCalendar();
    const { enqueueSnackbar } = useSnackbar();
    const [iterations, setIterations] = useState<Array<Iteration>>([]);

    useEffect(() => {
        let mounted = true;
        apiListIterations()
            .then((list) => {
                if (mounted) setIterations(list);
            })
            .catch((error) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "טעינת המחזורים נכשלה.",
                    error,
                ),
            );
        return () => {
            mounted = false;
        };
    }, [enqueueSnackbar]);

    const handleChange = useCallback(
        (event: SelectChangeEvent) => {
            const value = event.target.value;
            setIterationId(value === CURRENT_VALUE ? undefined : value);
        },
        [setIterationId],
    );

    // Nothing to switch between until a second iteration exists.
    if (iterations.length < 2) return null;

    return (
        <Box alignItems="center" display="flex" gap={1}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select
                    onChange={handleChange}
                    value={iterationId ?? CURRENT_VALUE}
                >
                    {iterations.map((iteration) => (
                        <MenuItem key={iteration.id} value={iteration.id}>
                            {iteration.label}
                            {iteration.isCurrent ? " (נוכחי)" : ""}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>
            {isReadOnlyIteration ? (
                <Chip
                    color="warning"
                    icon={<HistoryIcon />}
                    label="קריאה בלבד"
                    size="small"
                    variant="outlined"
                />
            ) : null}
        </Box>
    );
}
