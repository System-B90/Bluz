import { Button, ButtonProps, Typography, TypographyProps } from "@mui/material";
import Image from "next/image";
import { signIn, SignInOptions } from "next-auth/react";
import { useCallback } from "react";

import { getHiveBaseUrl } from "@/api-shared/common";

interface LoginWithHiveProps extends ButtonProps
{
    callbackUrl?: SignInOptions[ 'callbackUrl' ];
    fontSize?: TypographyProps[ 'fontSize' ];
    fontWeight?: TypographyProps[ 'fontWeight' ];
}

export default function LoginWithHive({
    callbackUrl = '/',
    fullWidth = true,
    variant = 'contained',
    onClick,
    size = 'large',
    fontSize = '1.2rem',
    fontWeight = 600,
    ...props
}: LoginWithHiveProps)
{

    // Added callbackUrl to the dependency array to prevent stale closures
    const defaultClickCallback = useCallback(
        () => signIn('hive', { callbackUrl }),
        [ callbackUrl ]
    );

    const clickCallback = onClick ?? defaultClickCallback;

    return (
        <Button
            onClick={ clickCallback }
            variant={ variant }
            fullWidth={ fullWidth }
            size={ size }
            startIcon={
                <Image
                    src={ `${getHiveBaseUrl()}/static/icon.svg` }
                    alt=""
                    width={ 24 }
                    height={ 24 }
                />
            }
            { ...props }
        >
            <Typography color='textPrimary' fontSize={ fontSize } fontWeight={ fontWeight }>
                התחברות עם הייב
            </Typography>
        </Button>
    );
}
