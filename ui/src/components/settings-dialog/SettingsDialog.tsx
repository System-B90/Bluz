import CloseIcon from "@mui/icons-material/Close";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import PersonIcon from "@mui/icons-material/Person";
import SettingsIcon from "@mui/icons-material/Settings";
import {
    Box,
    Dialog,
    IconButton,
    Typography,
} from "@mui/material";
import { useState } from "react";

import { ThemeSelectorIcon } from "@/components/header/ThemeSelector";
import { GlobalSettings } from "@/components/settings-dialog/tabs/global/GlobalSettings";
import { RoomSettings } from "@/components/settings-dialog/tabs/global/room-settings";
import { PersonalSettings } from "@/components/settings-dialog/tabs/PersonalSettings";

type SettingsDialogProps = {
    open: boolean;
    onClose: () => void;
};

export function SettingsDialog({ open, onClose }: SettingsDialogProps) {
    const [tab, setTab] = useState(0);

    const tabs = [
        { label: "אישי", icon: <PersonIcon />, value: 0 },
        { label: "כללי", icon: <SettingsIcon />, value: 1 },
        { label: "חדרים", icon: <MeetingRoomIcon />, value: 2 },
    ];

    return (
        <Dialog
            fullWidth
            maxWidth="lg"
            onClose={onClose}
            open={open}
            PaperProps={{
                sx: {
                    borderRadius: "20px",
                    overflow: "hidden",
                    bgcolor: "background.paper",
                    backgroundImage: "none",
                    boxShadow: "0 24px 50px rgba(0,0,0,0.15)",
                    border: "1px solid rgba(255,255,255,0.08)",
                },
            }}
        >
            {/* Main Flex Container */}
            <Box display="flex" flexDirection="row" sx={{ minHeight: 480 }}>

                {/* Sidebar Navigation */}
                <Box
                    sx={{
                        width: 220,
                        flexShrink: 0,
                        bgcolor: (theme) =>
                            theme.palette.mode === "light"
                                ? "rgba(103, 200, 221, 0.08)"
                                : "rgba(12, 34, 55, 0.6)",
                        borderLeft: "1px solid",
                        borderColor: "divider",
                        display: "flex",
                        flexDirection: "column",
                        p: 2.5,
                        gap: 1.5,
                    }}
                >
                    {/* Header Title */}
                    <Box sx={{ mb: 2 }}>
                        <Typography
                            sx={{
                                fontWeight: 800,
                                fontSize: "1.3rem",
                                color: "text.primary",
                                fontFamily: "Assistant, sans-serif",
                            }}
                        >
                            הגדרות
                        </Typography>
                        <Typography
                            sx={{
                                fontSize: "0.78rem",
                                color: "text.secondary",
                                mt: 0.5,
                            }}
                        >
                            ניהול העדפות המערכת
                        </Typography>
                    </Box>

                    {/* Navigation Items */}
                    {tabs.map((t) => {
                        const isActive = tab === t.value;
                        return (
                            <Box
                                key={t.value}
                                onClick={() => setTab(t.value)}
                                sx={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1.5,
                                    px: 2,
                                    py: 1.5,
                                    borderRadius: "10px",
                                    cursor: "pointer",
                                    transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                                    position: "relative",
                                    userSelect: "none",
                                    bgcolor: isActive
                                        ? "primary.main"
                                        : "transparent",
                                    color: isActive
                                        ? "primary.contrastText"
                                        : "text.secondary",
                                    borderRight: isActive ? "4px solid" : "0px solid",
                                    borderRightColor: isActive ? "primary.dark" : "transparent",
                                    boxShadow: isActive
                                        ? "0 4px 12px rgba(103, 200, 221, 0.25)"
                                        : "none",
                                    "&:hover": {
                                        bgcolor: isActive ? "primary.main" : "action.hover",
                                        color: isActive ? "primary.contrastText" : "text.primary",
                                        transform: isActive ? "none" : "translateX(-4px)",
                                    },
                                }}
                            >
                                <Box
                                    sx={{
                                        display: "flex",
                                        alignItems: "center",
                                        color: "inherit",
                                        "& svg": { fontSize: 20 },
                                    }}
                                >
                                    {t.icon}
                                </Box>
                                <Typography
                                    sx={{
                                        fontWeight: isActive ? 700 : 600,
                                        fontSize: "0.95rem",
                                        fontFamily: "Assistant, sans-serif",
                                    }}
                                >
                                    {t.label}
                                </Typography>
                            </Box>
                        );
                    })}

                    <Box sx={{ flexGrow: 1 }} />

                    {/* Theme Selector Container */}
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1,
                            pt: 2,
                            borderTop: "1px solid",
                            borderColor: "divider",
                        }}
                    >
                        <Typography
                            sx={{
                                fontSize: "0.78rem",
                                color: "text.secondary",
                                fontFamily: "Assistant, sans-serif",
                                fontWeight: 600,
                            }}
                        >
                            מצב תצוגה
                        </Typography>
                        <ThemeSelectorIcon />
                    </Box>
                </Box>

                {/* Content Pane */}
                <Box
                    sx={{
                        flexGrow: 1,
                        p: 4,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                    }}
                >
                    {/* Header Row with Close Button */}
                    <Box
                        sx={{
                            display: "flex",
                            justifyContent: "flex-end",
                            mb: 2.5,
                            mt: -1.5,
                        }}
                    >
                        <IconButton
                            className="hover-rotate-90"
                            onClick={onClose}
                            sx={{
                                bgcolor: "action.hover",
                                color: "text.secondary",
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    bgcolor: "action.selected",
                                    color: "text.primary",
                                    transform: "scale(1.1)",
                                },
                            }}
                        >
                            <CloseIcon sx={{ fontSize: 18 }} />
                        </IconButton>
                    </Box>

                    {/* Active Tab Panel with Entry Animation */}
                    <Box
                        className="animate-slide-up-fade"
                        key={tab}
                        sx={{ flexGrow: 1, height: "100%" }}
                    >
                        {tab === 0 && <PersonalSettings />}
                        {tab === 1 && <GlobalSettings />}
                        {tab === 2 && <RoomSettings />}
                    </Box>
                </Box>
            </Box>
        </Dialog>
    );
}
