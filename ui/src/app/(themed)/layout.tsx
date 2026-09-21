"use client";

import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { SessionProvider } from "next-auth/react";
import { SnackbarProvider } from "notistack";
import React from "react";

import "@/style/globals.css";

export default function ThemedLayout({
    children,
}: {
    children: React.ReactNode;
})
{
    // Hydration marker. Server-rendered markup is fully painted and clickable
    // before React attaches handlers, so an early click is a silent no-op —
    // the cause of the retry-until-it-works loops the e2e helpers used to
    // carry. Tests wait for this attribute instead.
    React.useEffect(() =>
    {
        document.body.dataset.hydrated = "true";
    }, []);

    return (
        <LocalizationProvider adapterLocale="he" dateAdapter={ AdapterDayjs }>
            <SnackbarProvider
                anchorOrigin={ { horizontal: "right", vertical: "bottom" } }
                // The stack is pinned to the physical right edge, but notistack
                // aligns its children with direction-relative `flex-end`, which
                // sends short snackbars to the left under RTL (#416).
                classes={ { containerRoot: "snackbar-container-physical-right" } }
                // A bulk action on the calendar (#706) writes one event at a
                // time, and each write toasts. Without this, deleting twenty
                // events queues twenty identical toasts three at a time.
                preventDuplicate
            >
                <SessionProvider>{ children }</SessionProvider>
            </SnackbarProvider>
        </LocalizationProvider>
    );
}
