"use client";

import HistoryIcon from "@mui/icons-material/History";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import FormControl from "@mui/material/FormControl";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import { useCallback } from "react";

import { useIterationScope } from "@/components/base/IterationProvider";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";

// `undefined` (no `?it=` param) means "the current run". The select
// still has to show *which* iteration that is, so it resolves the current
// iteration's own id rather than a sentinel value — a sentinel matches no menu
// item and MUI logs an out-of-range warning for it on every render.

/**
 * Lets the user switch the calendar between the current run and past iterations.
 * Past iterations are read-only reference material. Hidden until more than one
 * iteration is registered, so single-iteration deployments are unaffected.
 */
export function IterationSelector() {
    const { iterationId, setIterationId, isReadOnlyIteration } = useCalendar();
    const { iterations, currentIterationId: currentId } = useIterationScope();

    const handleChange = useCallback(
        (event: SelectChangeEvent) => {
            // Picking the current run has to clear the param, not pin its id
            // (#609). The rest of the calendar reads `undefined` as "current
            // run", and current-run broadcasts carry no iterationId — with a
            // concrete id set, every live update was filtered out and the
            // calendar went stale until a reload.
            const picked = event.target.value;
            setIterationId(picked === currentId ? undefined : picked);
        },
        [currentId, setIterationId],
    );

    // Nothing to switch between until a second iteration exists.
    if (iterations.length < 2) return null;

    return (
        <Box alignItems="center" display="flex" gap={1}>
            <FormControl size="small" sx={{ minWidth: 160 }}>
                <Select
                    onChange={handleChange}
                    value={iterationId ?? currentId ?? ""}
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
