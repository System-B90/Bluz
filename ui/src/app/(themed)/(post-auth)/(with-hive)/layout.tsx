"use client";
import WifiTetheringOffIcon from "@mui/icons-material/WifiTetheringOff";
import Box from "@mui/material/Box";
import Fab from "@mui/material/Fab";
import Tooltip from "@mui/material/Tooltip";
import React from "react";

import { CoursesProvider } from "@/components/base/CoursesProvider";
import { CustomColorsProvider } from "@/components/base/CustomColorsProvider";
import { HiveLessonsProvider } from "@/components/base/HiveLessonsProvider";
import { HiveModulesProvider } from "@/components/base/HiveModulesProvider";
import { HiveSubjectsProvider } from "@/components/base/HiveSubjectsProvider";
import { HiveUsersProvider } from "@/components/base/HiveUsersProvider";
import { OfflineProvider, useOffline } from "@/components/base/OfflineProvider";
import { OutsidersProvider } from "@/components/base/OutsidersProvider";
import { RoomsProvider } from "@/components/base/RoomsProvider";
import { SettingsProvider } from "@/components/base/SettingsProvider";
import { ScheduleAppBar } from "@/components/header/AppBar";
import { CalendarProvider } from "@/components/schedule/calendar/calendar-provider";
import { SettingsDialogUrl } from "@/components/settings-dialog/SettingsDialogUrl";
import { useSettingsDialogUrl } from "@/components/settings-dialog/UseSettingsDialogUrl";

function LayoutContent({ children }: { children: React.ReactNode }) {
    const { offlineMode } = useOffline();
    const { openDialog } = useSettingsDialogUrl();

    return (
        <Box
            bgcolor="background.default"
            display="flex"
            flexDirection="column"
            height="100vh"
            overflow={"hidden"}
            sx={{ p: 0 }}
            width="100vw"
        >
            <ScheduleAppBar openSettingsDialog={openDialog} />

            <Box
                height="calc(100vh - 56px)"
                sx={{
                    position: "relative",
                }}
            >
                {children}
            </Box>

            {offlineMode ? (
                <Tooltip placement="right" title="מצב עריכה לוקלי פעיל">
                    <Fab
                        aria-label="offline-status"
                        color="warning"
                        sx={{
                            position: "fixed",
                            bottom: 24,
                            left: 24,
                            zIndex: 1000,
                            background:
                                "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                            color: "white",
                            boxShadow: "0px 6px 20px rgba(217, 119, 6, 0.4)",
                            transition: "all 0.2s ease-in-out",
                            "&:hover": {
                                background:
                                    "linear-gradient(135deg, #d97706 0%, #b45309 100%)",
                                boxShadow:
                                    "0px 8px 24px rgba(217, 119, 6, 0.6)",
                                scale: "1.05",
                            },
                            "&:active": {
                                scale: "0.95",
                            },
                        }}
                    >
                        <WifiTetheringOffIcon className="text-[1.3rem]" />
                    </Fab>
                </Tooltip>
            ) : null}

            <SettingsDialogUrl />
        </Box>
    );
}

export default function PostAuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <HiveUsersProvider>
            <HiveSubjectsProvider>
                <HiveModulesProvider>
                    <HiveLessonsProvider>
                        <RoomsProvider>
                            <CustomColorsProvider>
                                <OutsidersProvider>
                                    <SettingsProvider>
                                        <CoursesProvider>
                                            <OfflineProvider>
                                                <CalendarProvider>
                                                    <LayoutContent>
                                                        {children}
                                                    </LayoutContent>
                                                </CalendarProvider>
                                            </OfflineProvider>
                                        </CoursesProvider>
                                    </SettingsProvider>
                                </OutsidersProvider>
                            </CustomColorsProvider>
                        </RoomsProvider>
                    </HiveLessonsProvider>
                </HiveModulesProvider>
            </HiveSubjectsProvider>
        </HiveUsersProvider>
    );
}
