"use client";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import { STUDENT_VIEW_PATH } from "@/api-shared/types/student-view";

/**
 * Staff-only banner over the student view: says plainly that this is a
 * preview, offers a way back, and lets staff step to another day.
 *
 * Rendered only when the *server* has confirmed Segel/Admin clearance — see
 * the page component. It is not a client-side gate.
 */
export function StudentPreviewBar({ date }: { date?: string }) {
    const router = useRouter();
    const value = date ?? dayjs().tz(APP_TIMEZONE).format("YYYY-MM-DD");

    const onDateChange = useCallback(
        (next: string) => {
            router.replace(
                next
                    ? `${STUDENT_VIEW_PATH}?date=${encodeURIComponent(next)}`
                    : STUDENT_VIEW_PATH,
            );
        },
        [router],
    );

    return (
        <Box
            alignItems="center"
            bgcolor="warning.main"
            color="warning.contrastText"
            display="flex"
            flexWrap="wrap"
            gap={2}
            px={2}
            py={1}
        >
            <Button
                color="inherit"
                component={Link}
                href="/"
                size="small"
                startIcon={<ArrowForwardIcon />}
            >
                חזור ללו&quot;ז
            </Button>

            <Typography variant="body2">
                תצוגת חניכים (תצוגה מקדימה) — כך נראה הלוח לחניך
            </Typography>

            <Box flexGrow={1} />

            <TextField
                label="תאריך"
                onChange={(e) => onDateChange(e.target.value)}
                size="small"
                slotProps={{ inputLabel: { shrink: true } }}
                sx={{ bgcolor: "background.paper", borderRadius: 1 }}
                type="date"
                value={value}
            />
        </Box>
    );
}
