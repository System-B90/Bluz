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

export function CliAuthWidget({ port, code, token }: CliAuthWidgetProps) {
    const [status, setStatus] = useState<"connecting" | "fallback" | "success">(() => {
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
            setStatus("fallback");
        }, 5000); // 5 seconds timeout to connect to localhost

        fetch(`http://127.0.0.1:${port}/callback?token=${encodeURIComponent(token)}`, {
            method: "GET",
            mode: "cors",
            signal: controller.signal,
        })
            .then((res) => {
                clearTimeout(timeoutId);
                if (res.ok) {
                    setStatus("success");
                } else {
                    setStatus("fallback");
                }
            })
            .catch(() => {
                clearTimeout(timeoutId);
                setStatus("fallback");
            });

        return () => {
            clearTimeout(timeoutId);
            controller.abort();
        };
    }, [port, token]);

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
            <Box alignItems="center" display="flex" flexDirection="column" gap={3}>
                {status === "connecting" && (
                    <>
                        <CircularProgress size={40} />
                        <Typography color="textSecondary" textAlign="center" variant="body1">
                            מבצע התחברות אוטומטית...
                        </Typography>
                    </>
                )}

                {status === "success" && (
                    <>
                        <CheckCircleIcon color="success" sx={{ fontSize: 60 }} />
                        <Typography color="textPrimary" fontWeight="bold" textAlign="center" variant="h6">
                            ההתחברות הושלמה בהצלחה!
                        </Typography>
                        <Typography color="textSecondary" textAlign="center" variant="body2">
                            ניתן לסגור לשונית זו ולחזור למסוף.
                        </Typography>
                    </>
                )}

                {status === "fallback" && (
                    <Box width="100%">
                        <Alert severity="warning" sx={{ mb: 3 }}>
                            <AlertTitle>לא הצלחנו להתחבר ל-CLI באופן אוטומטי</AlertTitle>
                            אנא העתק את קוד ההתחברות באופן ידני והדבק אותו במסוף.
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
