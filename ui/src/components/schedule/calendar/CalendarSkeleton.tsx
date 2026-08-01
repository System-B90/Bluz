"use client";
import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";

const DAY_COLUMNS = 6;
const SLOTS_PER_COLUMN = 8;

/**
 * Stands in for the week grid while the first event fetch is in flight.
 * Rendered as an overlay rather than instead of the calendar: the calendar
 * itself is what reports the visible date range, and without it mounted no
 * fetch is ever issued.
 *
 * Column order is irrelevant to RTL correctness here — the flex row inherits
 * the document's `dir="rtl"`, so it fills from the right like the real grid.
 */
export function CalendarSkeleton() {
    return (
        <Box
            aria-busy="true"
            aria-label="טוען לוח זמנים"
            sx={{
                position: "absolute",
                inset: 0,
                zIndex: 2,
                bgcolor: "background.default",
                display: "flex",
                flexDirection: "column",
                gap: 1,
                p: 2,
            }}
        >
            <Skeleton height={40} variant="rounded" width="100%" />

            <Box sx={{ display: "flex", flex: 1, gap: 1, minHeight: 0 }}>
                {Array.from({ length: DAY_COLUMNS }, (_, column) => (
                    <Box
                        key={column}
                        sx={{
                            display: "flex",
                            flex: 1,
                            flexDirection: "column",
                            gap: 1,
                        }}
                    >
                        <Skeleton height={24} variant="rounded" />
                        {Array.from({ length: SLOTS_PER_COLUMN }, (_, slot) => (
                            <Skeleton
                                key={slot}
                                sx={{ flex: 1 }}
                                variant="rounded"
                            />
                        ))}
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
