"use client";

import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { SessionProvider } from "next-auth/react";
import { SnackbarProvider } from "notistack";
import React from "react";

import { BluzThemeProvider } from "@/components/theme/ThemeProvider";

import "@/style/globals.css";

export default function ThemedLayout({
    children,
}: {
    children: React.ReactNode;
})
{
    return (
        <BluzThemeProvider>
            <LocalizationProvider adapterLocale="he" dateAdapter={ AdapterDayjs }>
                <SnackbarProvider
                    anchorOrigin={ { horizontal: "right", vertical: "bottom" } }
                >
                    <SessionProvider>{ children }</SessionProvider>
                </SnackbarProvider>
            </LocalizationProvider>
        </BluzThemeProvider>
    );
}
