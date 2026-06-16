import Button, { ButtonProps } from "@mui/material/Button";

import Typography, { TypographyProps } from "@mui/material/Typography";

import Image from "next/image";
import { signIn, SignInOptions } from "next-auth/react";
import { useCallback } from "react";

import { getHiveBaseUrl } from "@/api-shared/common";

type LoginWithHiveProps = {
    callbackUrl?: SignInOptions["callbackUrl"];
    fontSize?: TypographyProps["fontSize"];
    fontWeight?: TypographyProps["fontWeight"];
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
}: LoginWithHiveProps) {
    // Added callbackUrl to the dependency array to prevent stale closures
    const defaultClickCallback = useCallback(
        () => signIn("hive", { callbackUrl }),
        [callbackUrl],
    );

    const clickCallback = onClick ?? defaultClickCallback;

    return (
        <Button
            fullWidth={fullWidth}
            onClick={clickCallback}
            size={size}
            startIcon={
                <Image
                    alt=""
                    height={24}
                    src={`${getHiveBaseUrl()}/static/icon.svg`}
                    width={24}
                />
            }
            variant={variant}
            {...props}
        >
            <Typography
                color="inherit"
                fontSize={fontSize}
                fontWeight={fontWeight}
            >
                התחברות עם הייב
            </Typography>
        </Button>
    );
}
