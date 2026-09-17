import AlarmIcon from '@mui/icons-material/Alarm';
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import CloseIcon from "@mui/icons-material/Close";
import EventRepeatIcon from "@mui/icons-material/EventRepeat";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import PaletteIcon from "@mui/icons-material/Palette";
import PersonIcon from "@mui/icons-material/Person";
import Box from "@mui/material/Box";
import Dialog from "@mui/material/Dialog";
import IconButton from "@mui/material/IconButton";
import { alpha, Theme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";

import { ThemeSelectorIcon } from "@/components/header/ThemeSelector";
import { ColorSettings } from "@/components/settings-dialog/tabs/global/color-settings";
import { CourseBuilderSettings } from "@/components/settings-dialog/tabs/global/CourseBuilderSettings";
import { GlobalSettings } from "@/components/settings-dialog/tabs/global/GlobalSettings";
import { IterationSettings } from "@/components/settings-dialog/tabs/global/iteration-settings";
import { OutsiderSettings } from "@/components/settings-dialog/tabs/global/outsider-settings";
import { RoomSettings } from "@/components/settings-dialog/tabs/global/room-settings";
import { PersonalSettings } from "@/components/settings-dialog/tabs/PersonalSettings";
import {
    SettingsTab,
} from "@/components/settings-dialog/UseSettingsDialogUrl";

/** Translucent primary colour, matching the command palette's selection tint. */
function primaryAlpha(theme: Theme, opacity: number): string {
    const channel = theme.vars?.palette.primary.mainChannel;
    if (channel) return `rgb(${channel} / ${opacity})`;
    return alpha(theme.palette.primary.main, opacity);
}

type SettingsDialogProps = {
    activeTab: SettingsTab;
    onClose: () => void;
    onTabChange: (tab: SettingsTab) => void;
    open: boolean;
};

export function SettingsDialog({
    activeTab,
    onClose,
    onTabChange,
    open,
}: SettingsDialogProps)
{
    const tabs: Array<{ label: string; icon: React.ReactNode; value: SettingsTab; }> =
        [
            { label: "אישי", icon: <PersonIcon />, value: "personal" },
            {
                label: "אנשי חוץ",
                icon: <AssignmentIndIcon />,
                value: "outsiders",
            },
            { label: "צבעים", icon: <PaletteIcon />, value: "colors" },
            { label: "העדפות זמן", icon: <AlarmIcon />, value: "global" },
            { label: "חדרים", icon: <MeetingRoomIcon />, value: "rooms" },
            {
                label: "בניית קורסים",
                icon: <MenuBookIcon />,
                value: "courses",
            },
            {
                label: "מחזורים",
                icon: <EventRepeatIcon />,
                value: "iterations",
            },
        ];

    return (
        <Dialog
            fullWidth
            maxWidth="lg"
            onClose={ onClose }
            open={ open }
            PaperProps={ {
                sx: {
                    borderRadius: "20px",
                    overflow: "hidden",
                    bgcolor: "background.paper",
                    backgroundImage: "none",
                    boxShadow: "0 24px 50px rgba(0,0,0,0.15)",
                    maxHeight: "calc(100vh - 64px)",
                },
            } }
        >
            {/* Main Flex Container */ }
            <Box
                className="min-h-120"
                display="flex"
                flexDirection="row"
                sx={ { maxHeight: "calc(100vh - 64px)" } }
            >
                {/* Sidebar Navigation */ }
                <Box
                    sx={ (theme) => ({
                        width: 220,
                        flexShrink: 0,
                        bgcolor: `rgb(${theme.vars.palette.primary.mainChannel} / 0.08)`,
                        borderInlineEnd: "1px solid",
                        borderColor: "divider",
                        display: "flex",
                        flexDirection: "column",
                        p: 2.5,
                        gap: 1.5,
                        ...theme.applyStyles("dark", {
                            bgcolor: "rgba(12, 34, 55, 0.6)",
                        }),
                    }) }
                >
                    {/* Header Title */ }
                    <Box className="mb-4">
                        <Typography
                            sx={ {
                                fontWeight: 800,
                                fontSize: "1.3rem",
                                color: "text.primary",
                            } }
                        >
                            הגדרות
                        </Typography>
                        <Typography
                            sx={ {
                                fontSize: "0.78rem",
                                color: "text.secondary",
                                mt: 0.5,
                            } }
                        >
                            ניהול העדפות המערכת
                        </Typography>
                    </Box>

                    {/* Navigation Items */ }
                    { tabs.map((t) =>
                    {
                        const isActive = activeTab === t.value;
                        return (
                            <Box
                                aria-current={ isActive ? "page" : undefined }
                                // Rendered as a real <button>: a
                                // plain onClick Box is unreachable by keyboard,
                                // which stranded keyboard-only users on the tab
                                // the dialog happened to open on.
                                component="button"
                                key={ t.value }
                                onClick={ () => onTabChange(t.value) }
                                sx={ (theme) => ({
                                    appearance: "none",
                                    border: "none",
                                    font: "inherit",
                                    textAlign: "start",
                                    width: "100%",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 1.5,
                                    px: 2,
                                    py: 1.5,
                                    borderRadius: "10px",
                                    cursor: "pointer",
                                    transition:
                                        "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                                    position: "relative",
                                    userSelect: "none",
                                    bgcolor: isActive
                                        ? primaryAlpha(theme, 0.16)
                                        : "transparent",
                                    color: isActive
                                        ? "primary.main"
                                        : "text.secondary",
                                    // Logical: the active-tab accent sits on
                                    // the inline-start edge, matching the
                                    // sidebar's own borderInlineEnd below.
                                    borderInlineStart: isActive
                                        ? "4px solid"
                                        : "0px solid",
                                    borderInlineStartColor: isActive
                                        ? "primary.main"
                                        : "transparent",
                                    boxShadow: "none",
                                    "&:hover": {
                                        bgcolor: isActive
                                            ? primaryAlpha(theme, 0.22)
                                            : "action.hover",
                                        color: isActive
                                            ? "primary.main"
                                            : "text.primary",
                                        // Nudge toward the inline-start edge
                                        // (where the accent border lives)
                                        // rather than a hardcoded physical
                                        // direction.
                                        transform: isActive
                                            ? "none"
                                            : theme.direction === "rtl"
                                                ? "translateX(4px)"
                                                : "translateX(-4px)",
                                    },
                                }) }
                            >
                                <Box
                                    sx={ {
                                        display: "flex",
                                        alignItems: "center",
                                        color: "inherit",
                                        "& svg": { fontSize: 20 },
                                    } }
                                >
                                    { t.icon }
                                </Box>
                                <Typography
                                    sx={ {
                                        fontWeight: isActive ? 700 : 600,
                                        fontSize: "0.95rem",
                                    } }
                                >
                                    { t.label }
                                </Typography>
                            </Box>
                        );
                    }) }

                    <Box className="grow" />

                    {/* Theme Selector Container */ }
                    <Box
                        sx={ {
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 1,
                            pt: 2,
                            borderTop: "1px solid",
                            borderColor: "divider",
                        } }
                    >
                        <Typography
                            sx={ {
                                fontSize: "0.78rem",
                                color: "text.secondary",
                                fontWeight: 600,
                            } }
                        >
                            מצב תצוגה
                        </Typography>
                        <ThemeSelectorIcon />
                    </Box>

                    { process.env.NEXT_PUBLIC_APP_VERSION ? (
                        <Typography
                            sx={ {
                                fontSize: "0.7rem",
                                color: "text.disabled",
                                textAlign: "center",
                                pt: 0.5,
                            } }
                        >
                            v{ process.env.NEXT_PUBLIC_APP_VERSION }
                        </Typography>
                    ) : null }
                </Box>

                {/* Content Pane */ }
                <Box
                    sx={ {
                        flexGrow: 1,
                        p: 4,
                        minWidth: 0,
                        display: "flex",
                        flexDirection: "column",
                        overflowY: "auto",
                    } }
                >
                    {/* Header Row with Close Button */ }
                    <Box
                        sx={ {
                            display: "flex",
                            justifyContent: "flex-end",
                            mb: 2.5,
                            mt: -1.5,
                        } }
                    >
                        <IconButton
                            className="hover-rotate-90"
                            onClick={ onClose }
                            sx={ {
                                bgcolor: "action.hover",
                                color: "text.secondary",
                                transition: "all 0.2s ease",
                                "&:hover": {
                                    bgcolor: "action.selected",
                                    color: "text.primary",
                                    transform: "scale(1.1)",
                                },
                            } }
                        >
                            <CloseIcon className="text-[18px]" />
                        </IconButton>
                    </Box>

                    {/* Active Tab Panel with Entry Animation */ }
                    <Box
                        className="animate-slide-up-fade grow h-full"
                        key={ activeTab }
                    >
                        { activeTab === "personal" && <PersonalSettings /> }
                        { activeTab === "global" && <GlobalSettings /> }
                        { activeTab === "courses" && <CourseBuilderSettings /> }
                        { activeTab === "colors" && <ColorSettings /> }
                        { activeTab === "rooms" && <RoomSettings /> }
                        { activeTab === "outsiders" && <OutsiderSettings /> }
                        { activeTab === "iterations" && <IterationSettings /> }
                    </Box>

                    {/*
                      * Browsers drop the end-side padding of a scrolling flex
                      * container from the scrollable area (a longstanding
                      * flexbox/overflow quirk) — the pane's own `p: 4` never
                      * reaches the bottom once a tab's content overflows, so
                      * the last row/button sits flush against the dialog edge
                      * on short viewports. An explicit spacer inside the
                      * scrolled content is unaffected by that quirk.
                      */ }
                    <Box sx={ { flexShrink: 0, height: (theme) => theme.spacing(4) } } />
                </Box>
            </Box>
        </Dialog>
    );
}
