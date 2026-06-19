import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Collapse from "@mui/material/Collapse";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import React, { useMemo } from "react";

import {
    GanttDayIndex,
    getDayNameDisplay,
} from "@/api-shared/types/gantt/models";
import { TemporalDraft } from "@/components/gantt/module-dialog/constraints/types";

const DAYS_OF_WEEK = [
    {
        index: GanttDayIndex.Sunday,
        label: getDayNameDisplay(GanttDayIndex.Sunday),
        short: "א",
    },
    {
        index: GanttDayIndex.Monday,
        label: getDayNameDisplay(GanttDayIndex.Monday),
        short: "ב",
    },
    {
        index: GanttDayIndex.Tuesday,
        label: getDayNameDisplay(GanttDayIndex.Tuesday),
        short: "ג",
    },
    {
        index: GanttDayIndex.Wednesday,
        label: getDayNameDisplay(GanttDayIndex.Wednesday),
        short: "ד",
    },
    {
        index: GanttDayIndex.Thursday,
        label: getDayNameDisplay(GanttDayIndex.Thursday),
        short: "ה",
    },
    {
        index: GanttDayIndex.Friday,
        label: getDayNameDisplay(GanttDayIndex.Friday),
        short: "ו",
    },
    {
        index: GanttDayIndex.Saturday,
        label: getDayNameDisplay(GanttDayIndex.Saturday),
        short: "ש",
    },
] as const;

type WeekDayVisualizerProps = {
    validDays: Set<GanttDayIndex>;
};

export const WeekDayVisualizer: React.FC<WeekDayVisualizerProps> = ({
    validDays,
}) => {
    return (
        <Stack
            alignItems="center"
            direction="row"
            flexWrap="wrap"
            spacing={0.5}
        >
            {DAYS_OF_WEEK.map((day) => {
                const isValid = validDays.has(day.index as GanttDayIndex);
                return (
                    <Box
                        key={day.index}
                        sx={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            bgcolor: isValid
                                ? "primary.main"
                                : "action.disabledBackground",
                            color: isValid
                                ? "primary.contrastText"
                                : "text.disabled",
                            typography: "caption",
                            fontWeight: "bold",
                            transition: "all 0.2s ease-in-out",
                        }}
                    >
                        {day.short}
                    </Box>
                );
            })}
        </Stack>
    );
};

type TemporalDraftFieldsProps = {
    draft: TemporalDraft;
    setDraft: (draft: TemporalDraft) => void;
};

export function TemporalDraftFields({
    draft,
    setDraft,
}: TemporalDraftFieldsProps) {
    const validDays = useMemo(() => {
        const allowed =
            draft.allowedDays && draft.allowedDays.length > 0
                ? new Set(draft.allowedDays)
                : new Set(DAYS_OF_WEEK.map((d) => d.index as GanttDayIndex));

        const forbidden = new Set(draft.forbiddenDays || []);
        const valid = new Set<GanttDayIndex>();

        allowed.forEach((day) => {
            if (!forbidden.has(day)) {
                valid.add(day);
            }
        });

        return valid;
    }, [draft.allowedDays, draft.forbiddenDays]);

    const hasNoValidDays = validDays.size === 0;

    const allowedValues = useMemo(
        () =>
            DAYS_OF_WEEK.filter((d) =>
                (draft.allowedDays || []).includes(d.index as GanttDayIndex),
            ),
        [draft.allowedDays],
    );

    const forbiddenValues = useMemo(
        () =>
            DAYS_OF_WEEK.filter((d) =>
                (draft.forbiddenDays || []).includes(d.index as GanttDayIndex),
            ),
        [draft.forbiddenDays],
    );

    const handleAllowedChange = (
        _event: React.SyntheticEvent,
        newValue: Array<(typeof DAYS_OF_WEEK)[number]>,
    ) => {
        setDraft({
            ...draft,
            allowedDays: newValue.map((v) => v.index as GanttDayIndex),
        });
    };

    const handleForbiddenChange = (
        _event: React.SyntheticEvent,
        newValue: Array<(typeof DAYS_OF_WEEK)[number]>,
    ) => {
        setDraft({
            ...draft,
            forbiddenDays: newValue.map((v) => v.index as GanttDayIndex),
        });
    };

    return (
        <Stack direction="row" spacing={3}>
            <Stack alignItems="flex-start" direction="row" spacing={2}>
                <Autocomplete
                    getOptionLabel={(option) => option.label}
                    isOptionEqualToValue={(option, value) =>
                        option.index === value.index
                    }
                    multiple
                    onChange={handleAllowedChange}
                    options={DAYS_OF_WEEK}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="מותר שיהיה בימי..."
                            placeholder="בחרו ימים"
                        />
                    )}
                    size="small"
                    sx={{ width: 250 }}
                    value={allowedValues}
                />
                <Autocomplete
                    getOptionLabel={(option) => option.label}
                    isOptionEqualToValue={(option, value) =>
                        option.index === value.index
                    }
                    multiple
                    onChange={handleForbiddenChange}
                    options={DAYS_OF_WEEK}
                    renderInput={(params) => (
                        <TextField
                            {...params}
                            label="אסור שיהיה בימי..."
                            placeholder="בחרו ימים"
                        />
                    )}
                    size="small"
                    sx={{ width: 250 }}
                    value={forbiddenValues}
                />
            </Stack>

            <Stack alignItems="center" direction="row" spacing={3}>
                <WeekDayVisualizer validDays={validDays} />
                <Collapse in={hasNoValidDays} orientation="vertical">
                    <Alert severity="warning" sx={{ py: 0, px: 2 }}>
                        לא קיים יום העונה על הדרישות
                    </Alert>
                </Collapse>
            </Stack>
        </Stack>
    );
}
