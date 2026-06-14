"use client";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { LoginWithHive } from "@/app/(themed)/(pre-auth)/login/login-with-hive-button";
import { Logo } from "@/components/header/logo";

function getAuthenticationErrorMessage(error: null | string) {
    switch (error) {
        case null:
            return null;
        case "AccessDenied":
            return "למשתמש שלך אין הרשאה מתאימה לגישה למערכת.";
        case "OAuthAccountNotLinked":
            return "כתובת המייל משויכת לחשבון קיים. יש להתחבר באמצעות שיטת ההתחברות המקורית.";
        case "OAuthCallback":
        case "OAuthSignin":
            return "לא ניתן היה להשלים את תהליך ההזדהות מול הייב.";
        case "SessionRequired":
            return "נדרשת התחברות מחדש כדי להמשיך.";
        default:
            return "אירעה שגיאה במהלך תהליך ההתחברות.";
    }
}

function LoginWidget() {
    const searchParams = useSearchParams();
    const authError = searchParams.get("error");
    const authErrorMessage = getAuthenticationErrorMessage(authError);
    const authErrorDetails =
        searchParams.get("error_description") ??
        searchParams.get("message") ??
        authError;

    return (
        <Box
            bgcolor={"background.paper"}
            border={"1px solid"}
            borderColor={(theme) =>
                theme.palette.mode === "light"
                    ? "rgba(0,0,0,0.08)"
                    : "rgba(255,255,255,0.08)"
            }
            borderRadius={"20px"}
            boxShadow={"0 24px 50px rgba(0,0,0,0.15)"}
            display={"flex"}
            flexDirection={"column"}
            gap={4}
            maxWidth={"448px"}
            p={5}
            width={"100%"}
        >
            {/* Header Section */}
            <Box
                alignItems={"center"}
                display={"flex"}
                flexDirection={"column"}
                fontSize={30}
                fontWeight={"bold"}
                textAlign={"center"}
            >
                <Logo height={"8rem"} width={"8rem"} />
                <Typography
                    color={"textPrimary"}
                    component={"h2"}
                    fontSize={"inherit"}
                    fontWeight={"bold"}
                    letterSpacing={"-0.02em"}
                    mt={1}
                >
                    ברוכים הבאים לבלוז
                </Typography>

                <Typography
                    color={"textSecondary"}
                    component={"p"}
                    fontSize={14}
                    mt={0}
                >
                    מתי אתם מבזרים?
                </Typography>
            </Box>

            <Box mt={0}>
                {authErrorMessage ? (
                    <Alert severity="error" sx={{ mb: 2 }}>
                        <AlertTitle>ההתחברות נכשלה</AlertTitle>
                        {authErrorMessage}
                        {authErrorDetails ? (
                            <Typography component="p" fontSize={13} mt={1}>
                                קוד שגיאה: {authErrorDetails}
                            </Typography>
                        ) : null}
                    </Alert>
                ) : null}
                <LoginWithHive />
            </Box>
        </Box>
    );
}

export default function LoginPage() {
    return (
        <Box
            alignContent={"flex-start"}
            alignItems={"flex-start"}
            bgcolor={"background.default"}
            display={"flex"}
            height={"100vh"}
            justifyContent={"center"}
            justifyItems={"flex-start"}
            pt={"20vh"}
            width={"full"}
        >
            <Suspense fallback={null}>
                <LoginWidget />
            </Suspense>
        </Box>
    );
}
