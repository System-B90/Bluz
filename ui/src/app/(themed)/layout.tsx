"use client";

import { LocalizationProvider } from "@mui/x-date-pickers";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { SessionProvider } from "next-auth/react";
import { SnackbarProvider } from "notistack";
import React from "react";

import { BluzThemeProvider } from "@/components/theme/ThemeProvider";

export default function ThemedLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <BluzThemeProvider>
            <LocalizationProvider adapterLocale="he" dateAdapter={AdapterDayjs}>
                <SnackbarProvider
                    anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
                >
                    <SessionProvider>{children}</SessionProvider>
                </SnackbarProvider>
            </LocalizationProvider>
        </BluzThemeProvider>
    );
}
