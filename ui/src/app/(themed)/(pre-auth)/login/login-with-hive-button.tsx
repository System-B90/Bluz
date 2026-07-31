import Button, { ButtonProps } from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Typography, { TypographyProps } from "@mui/material/Typography";
import { signIn, SignInOptions } from "next-auth/react";
import { useCallback, useState } from "react";

import { HiveLogo } from "@/components/base/HiveLogo";

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

    // Added callbackUrl to the dependency array to prevent stale closures
    const defaultClickCallback = useCallback(() =>
    {
        setIsSigningIn(true);
        void signIn("hive", { callbackUrl }).catch(() => setIsSigningIn(false));
    }, [ callbackUrl ]);

    const clickCallback = onClick ?? defaultClickCallback;

    return (
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
    );
}
