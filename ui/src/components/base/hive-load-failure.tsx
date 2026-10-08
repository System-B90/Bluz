"use client";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Collapse from "@mui/material/Collapse";
import Typography from "@mui/material/Typography";
import { closeSnackbar, enqueueSnackbar, SnackbarKey } from "notistack";
import React, { useState } from "react";

import { ClientApiWarning, UserNotLoggedInError } from "@/api-shared/errors";

/** The Hive lookups whose failure the user is told about, and what each one costs them. */
export const HIVE_RESOURCE_EFFECTS = {
    subjects: "שמות מקצועות",
    users: "שמות משתמשים ומדריכים",
    lessons: "שיעורים",
    modules: "מערכים",
} as const;

export type HiveResource = keyof typeof HIVE_RESOURCE_EFFECTS;

type Failure = { details: string; retry: () => void };

const SNACKBAR_KEY = "hive-load-failure";
/** Failures that land within this window share one toast. */
const MERGE_WINDOW_MS = 400;

const pending = new Map<HiveResource, Failure>();
let flushTimer: null | ReturnType<typeof setTimeout> = null;

/** The plain-language toast text: what is unavailable and what the user loses (#823). */
export function hiveFailureMessage(resources: ReadonlyArray<HiveResource>): string
{
    const effects = resources.map((resource) => HIVE_RESOURCE_EFFECTS[ resource ]);
    return `נתונים מהייב לא זמינים כרגע: ${effects.join(" ו")} לא יוצגו.`;
}

function technicalDetails(error: unknown): string
{
    if (error instanceof Error) return error.message ? `${error.name}: ${error.message}` : error.name;
    return String(error);
}

const HiveFailureBody: React.FC<{ message: string; details: Array<string> }> = ({ message, details }) =>
{
    const [ open, setOpen ] = useState(false);
    return (
        <Box>
            <Typography variant="body2">{ message }</Typography>
            <Button
                aria-expanded={ open }
                color="inherit"
                onClick={ () => setOpen((value) => !value) }
                size="small"
                sx={ { px: 0, minWidth: 0, textDecoration: "underline" } }
            >
                פרטים
            </Button>
            <Collapse in={ open }>
                { details.map((line) => (
                    <Typography component="p" key={ line } sx={ { fontSize: "0.7em", direction: "ltr" } }>
                        { line }
                    </Typography>
                )) }
            </Collapse>
        </Box>
    );
};

function flush()
{
    flushTimer = null;
    if (pending.size === 0) return;
    const failures = new Map(pending);
    pending.clear();

    closeSnackbar(SNACKBAR_KEY);
    enqueueSnackbar(
        <HiveFailureBody
            details={ [ ...failures.values() ].map((failure) => failure.details) }
            message={ hiveFailureMessage([ ...failures.keys() ]) }
        />,
        {
            key: SNACKBAR_KEY,
            variant: "error",
            persist: true,
            // Bottom-centre: the default bottom-right toast sat over the
            // gantt sidebar's hours card.
            anchorOrigin: { horizontal: "center", vertical: "bottom" },
            action: (key: SnackbarKey) => (
                <>
                    <Button
                        color="inherit"
                        onClick={ () =>
                        {
                            closeSnackbar(key);
                            failures.forEach((failure) => failure.retry());
                        } }
                        size="small"
                    >
                        נסה שוב
                    </Button>
                    <Button color="inherit" onClick={ () => closeSnackbar(key) } size="small">
                        סגירה
                    </Button>
                </>
            ),
        },
    );
}

/**
 * Report a failed Hive lookup (#823). Failures close together merge into one
 * toast that says, in plain Hebrew, what the user loses, with a retry action;
 * the technical error sits behind a `פרטים` toggle.
 */
export function reportHiveLoadFailure(resource: HiveResource, error: unknown, retry: () => void): void
{
    if (error instanceof UserNotLoggedInError || error instanceof ClientApiWarning) return;
    pending.set(resource, { details: technicalDetails(error), retry });
    if (flushTimer === null) flushTimer = setTimeout(flush, MERGE_WINDOW_MS);
}
