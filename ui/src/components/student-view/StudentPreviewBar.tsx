"use client";

import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import type { Dayjs } from "dayjs";
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
    const value = dayjs(date ?? undefined).tz(APP_TIMEZONE);

    const onDateChange = useCallback(
        (next: Dayjs | null) => {
            router.replace(
                next?.isValid()
                    ? `${STUDENT_VIEW_PATH}?date=${encodeURIComponent(next.format("YYYY-MM-DD"))}`
                    : STUDENT_VIEW_PATH,
            );
        },
        [router],
    );

    return (
        <Box
            alignItems="center"
            display="flex"
            flexWrap="wrap"
            gap={2}
            sx={{
                bgcolor: "background.paper",
                borderBottom: 1,
                borderColor: "divider",
                color: "text.primary",
                px: 2,
                py: 1,
            }}
        >
            <Button
                color="inherit"
                component={Link}
                href="/"
                size="small"
                startIcon={<ArrowForwardIcon />}
                sx={{ color: "text.secondary" }}
            >
                חזור ללו&quot;ז
            </Button>

            <Chip
                color="warning"
                label="תצוגה מקדימה"
                size="small"
                variant="outlined"
            />

            <Typography color="text.secondary" variant="body2">
                תצוגת חניכים — כך נראה הלוח לחניך
            </Typography>

            <Box flexGrow={1} />

            <DatePicker
                format="DD/MM/YYYY"
                label="תאריך"
                onChange={onDateChange}
                slotProps={{ textField: { size: "small" } }}
                value={value}
            />
        </Box>
    );
}
