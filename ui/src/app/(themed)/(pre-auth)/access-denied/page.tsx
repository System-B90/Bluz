"use client";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const HIVE_URL = process.env.NEXT_PUBLIC_HIVE_URL?.replace(/\/$/, "");

/**
 * Mirrors `getHiveClearanceDeniedMessage` from @system-b90/hive-nextauth 0.2;
 * `gender` (a GenderEnum value) picks the Hebrew verb form.
 */
function clearanceInstruction(clearance: null | string, gender: null | string): null | string {
    const pick = (male: string, female: string, neutral: string) =>
        gender === "Male" ? male : gender === "Female" ? female : neutral;
    switch (clearance) {
    case "1": // Hanich
        return `${pick("גש", "גשי", "גש/י")} לחד"ס`;
    case "2": // Checker
        return `${pick("תפנה", "תפני", "תפנה/י")} לאיש הסגל הקרוב לביתך`;
    default:
        return null;
    }
}

/**
 * Where hive-nextauth's clearance gate sends a user whose Hive login worked
 * but whose clearance isn't allowed in (`?reason=clearance&clearance=<n>`),
 * and where a page can send a signed-in user it won't serve
 * (`?reason=forbidden`). Styled as a sibling of the login card.
 */
function AccessDeniedCard() {
    const searchParams = useSearchParams();
    const isForbidden = searchParams.get("reason") === "forbidden";
    const instruction = clearanceInstruction(
        searchParams.get("clearance"),
        searchParams.get("gender"),
    );

    return (
        <Box
            bgcolor="background.paper"
            border="1px solid"
            borderRadius="20px"
            display="flex"
            flexDirection="column"
            gap={3}
            maxWidth="448px"
            p={5}
            sx={(theme) => ({
                borderColor: "rgba(0,0,0,0.08)",
                boxShadow: "0 24px 50px rgba(0,0,0,0.15)",
                ...theme.applyStyles("dark", {
                    borderColor: "rgba(255,255,255,0.08)",
                }),
            })}
            textAlign="center"
            width="100%"
        >
            <Box
                alignItems="center"
                alignSelf="center"
                bgcolor="error.main"
                borderRadius="50%"
                color="error.contrastText"
                display="flex"
                height={64}
                justifyContent="center"
                width={64}
            >
                <LockOutlinedIcon fontSize="large" />
            </Box>

            <Box>
                <Typography
                    color="textPrimary"
                    component="h1"
                    fontSize={26}
                    fontWeight="bold"
                    letterSpacing="-0.02em"
                >
                    אין הרשאת גישה
                </Typography>
                <Typography color="textSecondary" component="p" fontSize={14} mt={1}>
                    { isForbidden
                        ? "אין לך הרשאה לצפות בדף הזה."
                        : "ההתחברות להייב הצליחה, אבל למשתמש שלך אין הרשאה לגשת לבלוז." }
                </Typography>
            </Box>

            { instruction ? (
                <Alert icon={ false } severity="info" sx={ { justifyContent: "center", fontSize: 18, fontWeight: "bold" } }>
                    { instruction }
                </Alert>
            ) : (
                <Typography color="textSecondary" component="p" fontSize={13}>
                    אם לדעתך מדובר בטעות, פנו לצוות המערכת.
                </Typography>
            ) }

            <Box display="flex" flexDirection="column" gap={1.5}>
                { isForbidden ? (
                    <Button fullWidth href="/" size="large" variant="contained">
                        חזרה לדף הבית
                    </Button>
                ) : (
                    <>
                        <Button fullWidth href="/login" size="large" variant="contained">
                            חזרה לדף ההתחברות
                        </Button>
                        { HIVE_URL ? (
                            <Button fullWidth href={ HIVE_URL } variant="text">
                                מעבר להייב (להחלפת משתמש)
                            </Button>
                        ) : null }
                    </>
                ) }
            </Box>
        </Box>
    );
}

export default function AccessDeniedPage() {
    return (
        <Box
            alignItems="flex-start"
            bgcolor="background.default"
            display="flex"
            flexGrow={1}
            justifyContent="center"
            pt="15vh"
            px={2}
            width="100%"
        >
            <Suspense fallback={null}>
                <AccessDeniedCard />
            </Suspense>
        </Box>
    );
}
