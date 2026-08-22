/**
 * Name: ApiErrorSnackbar.tsx
 * Purpose: JSX/MUI snackbar renderers for API errors and subtext messages.
 *   Moved out of api-client/common.tsx (#544/10) — api-client's own README
 *   says it must not hold UI components/styles; these render markup, so
 *   they belong here.
 * Created: 2026-08-22
 * Author: Michael K. Steinberg
 */
import Typography from "@mui/material/Typography";
import { EnqueueSnackbar, OptionsObject, VariantType } from "notistack";
import React from "react";

import {
    ClientApiError,
    ClientApiWarning,
    ServerNetworkError,
    UserNotLoggedInError,
} from "@/api-shared/errors";

export function enqueueSnackbarWithSubtext(
    enqueueSnackbar: EnqueueSnackbar | undefined,
    mainText: React.ReactNode | string,
    subText: React.ReactNode | string,
    options?: OptionsObject<VariantType>,
) {
    if (enqueueSnackbar !== undefined) {
        if (typeof subText === "string") {
            enqueueSnackbar(
                <div className="flex flex-col">
                    <p>{mainText}</p>
                    <Typography component="p" sx={{ fontSize: "0.7em" }}>
                        {subText}
                    </Typography>
                </div>,
                options,
            );
        } else {
            enqueueSnackbar(
                <div className="flex flex-col">
                    <p>{mainText}</p>
                    <Typography component="div" sx={{ fontSize: "0.7em" }}>
                        {subText}
                    </Typography>
                </div>,
                options,
            );
        }
    } else {
        console.log(mainText, subText);
    }
}

export function enqueueApiErrorSnackbar(
    enqueueSnackbar: EnqueueSnackbar | undefined,
    mainText: React.ReactNode | string,
    error: unknown,
) {
    if (error instanceof UserNotLoggedInError) {
        console.log(error.message);
        return;
    }
    if (error instanceof ClientApiWarning) {
        return;
    }

    if (!(error instanceof ClientApiError)) {
        return enqueueSnackbarWithSubtext(
            enqueueSnackbar,
            mainText,
            error instanceof ServerNetworkError ? `Network error` : `${error}`,
            { variant: "error" },
        );
    } else {
        console.log(error);
        return enqueueSnackbarWithSubtext(
            enqueueSnackbar,
            mainText,
            <>
                <Typography fontSize={"inherit"} fontWeight={500}>
                    {error.name}
                    {error.message ? ": " : ""}
                </Typography>
                <Typography fontSize={"inherit"} fontWeight={400}>
                    {error.message}
                </Typography>
            </>,
            { variant: "error" },
        );
    }
}
