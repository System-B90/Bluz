"use client";

import Alert from "@mui/material/Alert";
import Button, { ButtonProps } from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Snackbar from "@mui/material/Snackbar";
import Typography, { TypographyProps } from "@mui/material/Typography";
import { signIn, SignInOptions } from "next-auth/react";
import { useCallback, useState } from "react";

import { HiveLogo } from "@/components/base/HiveLogo";

const SIGN_IN_TIMEOUT_MS = 15000;

type LoginWithHiveProps = {
    callbackUrl?: SignInOptions[ "callbackUrl" ];
    fontSize?: TypographyProps[ "fontSize" ];
    fontWeight?: TypographyProps[ "fontWeight" ];
} & ButtonProps;

export function LoginWithHive({
    callbackUrl = "/",
    fullWidth = true,
    variant = "contained",
    onClick,
    size = "large",
    fontSize = "1.2rem",
    fontWeight = 600,
    ...props
}: LoginWithHiveProps)
{
    const [ isSigningIn, setIsSigningIn ] = useState(false);
    const [ errorMessage, setErrorMessage ] = useState<null | string>(null);

    // Added callbackUrl to the dependency array to prevent stale closures
    const defaultClickCallback = useCallback(() =>
    {
        setIsSigningIn(true);
        setErrorMessage(null);

        const timeout = new Promise<never>((_, reject) =>
        {
            setTimeout(() => reject(new Error("timeout")), SIGN_IN_TIMEOUT_MS);
        });

        void Promise.race([ signIn("hive", { callbackUrl }), timeout ]).catch(() =>
        {
            setIsSigningIn(false);
            setErrorMessage("ההתחברות נכשלה. נסו שוב מאוחר יותר.");
        });
    }, [ callbackUrl ]);

    const clickCallback = onClick ?? defaultClickCallback;

    return (
        <>
            <Button
                disabled={ isSigningIn }
                fullWidth={ fullWidth }
                onClick={ clickCallback }
                size={ size }
                startIcon={
                    isSigningIn ? (
                        <CircularProgress color="inherit" size={ 20 } />
                    ) : (
                        <HiveLogo generic={ false } size={ 24 } />
                    )
                }
                variant={ variant }
                { ...props }
            >
                <Typography
                    color="inherit"
                    fontSize={ fontSize }
                    fontWeight={ fontWeight }
                >
                    { isSigningIn ? "מתחברים..." : "התחברות עם הייב" }
                </Typography>
            </Button>
            <Snackbar
                autoHideDuration={ 6000 }
                onClose={ () => setErrorMessage(null) }
                open={ errorMessage !== null }
            >
                <Alert onClose={ () => setErrorMessage(null) } severity="error">
                    { errorMessage }
                </Alert>
            </Snackbar>
        </>
    );
}
