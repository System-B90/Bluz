"use client";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import Alert from "@mui/material/Alert";
import AlertTitle from "@mui/material/AlertTitle";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useEffect, useState } from "react";

import { Logo } from "@/components/header/logo";

type CliAuthWidgetProps = {
    port: string;
    code: string;
    token: string;
};

export type CliAuthStatus = "connecting" | "fallback" | "handoff" | "success";

export function callbackUrl(port: string, code: string, token: string) {
    // The CLI's local callback server requires this exact verification code
    // (the same one shown on screen) to accept the token — otherwise any
    // local process that reached the callback port during the login window
    // could inject its own token (#521).
    return `http://127.0.0.1:${port}/callback?code=${encodeURIComponent(code)}&token=${encodeURIComponent(token)}`;
}

export function CliAuthWidget({ port, code, token }: CliAuthWidgetProps) {
    const [status, setStatus] = useState<CliAuthStatus>(() => {
        return !port || !token ? "fallback" : "connecting";
    });
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!port || !token) {
            return;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
            controller.abort();
            setStatus("handoff");
        }, 3000);

        fetch(callbackUrl(port, code, token), {
            method: "GET",
            mode: "cors",
            signal: controller.signal,
        })
            .then((res) => {
                clearTimeout(timeoutId);
                // A non-ok response still proves the CLI server is reachable,
                // but it did not accept the token, so manual paste is the only
                // way forward — handing off to a new tab would just show the
                // same error.
                setStatus(res.ok ? "success" : "fallback");
            })
            .catch(() => {
                // Chrome's Local Network Access check refuses an HTTPS page
                // reaching 127.0.0.1 as a subresource, and no header the CLI
                // sends back changes that — this is why login used to sit out
                // the CLI's full 60s timeout. A top-level navigation is not
                // subject to CORS or LNA, so hand off to one. It needs a user
                // gesture to survive the popup blocker, hence a button rather
                // than an automatic window.open here.
                clearTimeout(timeoutId);
                setStatus("handoff");
            });

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [port, token]);

    const handleHandoff = () => {
        const opened = window.open(
            callbackUrl(port, code, token),
            "_blank",
            "noopener",
        );
        if (!opened) {
            // Popup blocked despite the gesture — navigating this tab still
            // completes the login; the CLI serves a real page at the callback.
            window.location.href = callbackUrl(port, code, token);
        }
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(token);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error("Failed to copy token", err);
        }
    };

    return (
        <Box
            bgcolor="background.paper"
            border="1px solid"
            borderRadius="20px"
            display="flex"
            flexDirection="column"
            gap={4}
            maxWidth="448px"
            p={5}
            sx={(theme) => ({
                borderColor: "rgba(0,0,0,0.08)",
                boxShadow: "0 24px 50px rgba(0,0,0,0.15)",
                ...theme.applyStyles("dark", {
                    borderColor: "rgba(255,255,255,0.08)",
                }),
            })}
            width="100%"
        >
            {/* Header Section */}
            <Box
                alignItems="center"
                display="flex"
                flexDirection="column"
                fontSize={30}
                fontWeight="bold"
                textAlign="center"
            >
                <Logo height="8rem" width="8rem" />
                <Typography
                    color="textPrimary"
                    component="h2"
                    fontSize="inherit"
                    fontWeight="bold"
                    letterSpacing="-0.02em"
                    mt={1}
                >
                    חיבור ה-CLI לבלוז
                </Typography>
            </Box>

            {/* Verification Code Box */}
            {!!code && status !== "fallback" && (
                <Box
                    alignItems="center"
                    bgcolor="action.hover"
                    borderRadius="10px"
                    display="flex"
                    flexDirection="column"
                    gap={1}
                    p={2}
                    textAlign="center"
                >
                    <Typography color="textSecondary" variant="caption">
                        ודא שהקוד המוצג במסוף תואם לקוד הבא:
                    </Typography>
                    <Typography
                        color="textPrimary"
                        fontFamily="monospace"
                        fontSize="2rem"
                        fontWeight="bold"
                        letterSpacing="0.1em"
                    >
                        {code}
                    </Typography>
                </Box>
            )}

            {/* Status / Actions Area */}
            <Box
                alignItems="center"
                display="flex"
                flexDirection="column"
                gap={3}
            >
                {status === "connecting" && (
                    <>
                        <CircularProgress size={40} />
                        <Typography
                            color="textSecondary"
                            textAlign="center"
                            variant="body1"
                        >
                            מבצע התחברות אוטומטית...
                        </Typography>
                    </>
                )}

                {status === "success" && (
                    <>
                        <CheckCircleIcon
                            color="success"
                            sx={{ fontSize: 60 }}
                        />
                        <Typography
                            color="textPrimary"
                            fontWeight="bold"
                            textAlign="center"
                            variant="h6"
                        >
                            ההתחברות הושלמה בהצלחה!
                        </Typography>
                        <Typography
                            color="textSecondary"
                            textAlign="center"
                            variant="body2"
                        >
                            ניתן לסגור לשונית זו ולחזור למסוף.
                        </Typography>
                    </>
                )}

                {status === "handoff" && (
                    <Box width="100%">
                        <Alert severity="info" sx={{ mb: 3 }}>
                            <AlertTitle>
                                נדרש אישור לפתיחת החיבור המקומי
                            </AlertTitle>
                            הדפדפן חוסם פנייה ישירה מהאתר אל ה-CLI. לחץ להשלמת
                            ההתחברות בלשונית חדשה.
                        </Alert>
                        <Button
                            data-testid="cli-auth-handoff"
                            fullWidth
                            onClick={handleHandoff}
                            variant="contained"
                        >
                            השלם התחברות
                        </Button>
                        <Button
                            fullWidth
                            onClick={() => setStatus("fallback")}
                            sx={{ mt: 1 }}
                            variant="text"
                        >
                            העתק את הקוד באופן ידני
                        </Button>
                    </Box>
                )}

                {status === "fallback" && (
                    <Box width="100%">
                        <Alert severity="warning" sx={{ mb: 3 }}>
                            <AlertTitle>
                                לא הצלחנו להתחבר ל-CLI באופן אוטומטי
                            </AlertTitle>
                            אנא העתק את קוד ההתחברות באופן ידני והדבק אותו
                            במסוף.
                        </Alert>
                        <Box display="flex" gap={1} width="100%">
                            <TextField
                                fullWidth
                                label="קוד התחברות (Token)"
                                size="small"
                                slotProps={{
                                    input: {
                                        readOnly: true,
                                    },
                                }}
                                // Masked -- this still SSRs the session token
                                // into the DOM (a larger redesign, redeeming a
                                // short-lived single-use code server-side
                                // instead, is left for a follow-up), but a
                                // type="password" field at least keeps it off
                                // the visible screen and out of screenshots
                                // (#520).
                                type="password"
                                value={token}
                                variant="outlined"
                            />
                            <Button
                                color={copied ? "success" : "primary"}
                                onClick={handleCopy}
                                startIcon={copied ? null : <ContentCopyIcon />}
                                sx={{ minWidth: "100px" }}
                                variant="contained"
                            >
                                {copied ? "הועתק!" : "העתק"}
                            </Button>
                        </Box>
                    </Box>
                )}
            </Box>
        </Box>
    );
}
