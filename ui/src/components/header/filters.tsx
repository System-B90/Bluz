import ChatIcon from "@mui/icons-material/Chat";
import DoNotDisturbAltIcon from "@mui/icons-material/DoNotDisturbAlt";
import SynagogueIcon from "@mui/icons-material/Synagogue";
import WarningIcon from "@mui/icons-material/Warning";
import Box, { BoxProps } from "@mui/material/Box";

import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useCallback } from "react";

import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { FilterCourses } from "@/components/header/FilterCourses";
import { FilterInstructors } from "@/components/header/FilterInstructor";

export function Filters({ ...props }: BoxProps) {
    const {
        showPAsFor,
        setShowPAsFor,
        hidePrayers,
        setHidePrayers,
        showMisconfigurations,
        setShowMisconfigurations,
    } = useCalendarFilters();

    const handleShowPA = useCallback(() => {
        setShowPAsFor((v) => (v === null ? 365 : null));
    }, [setShowPAsFor]);

    return (
        <Box {...props}>
            <FilterInstructors
                boxSizing={"border-box"}
                minWidth={200}
                width={"auto"}
            />
            <FilterCourses
                boxSizing={"border-box"}
                minWidth={200}
                width={"auto"}
            />

            <Tooltip
                title={
                    showPAsFor !== null ? 'הסתר חלונות פ"א' : 'גלה חלונות פ"א'
                }
            >
                <IconButton
                    color={showPAsFor !== null ? "primary" : "inherit"}
                    onClick={handleShowPA}
                >
                    <ChatIcon />
                </IconButton>
            </Tooltip>

            <Tooltip title={hidePrayers ? "הצג תפילות" : "הסתר תפילות"}>
                <IconButton
                    className="relative"
                    color="inherit"
                    onClick={() => setHidePrayers((v) => !v)}
                >
                    <SynagogueIcon
                        sx={{
                            opacity: hidePrayers ? 0.7 : 1,
                            padding: hidePrayers ? 0.3 : 0,
                        }}
                    />
                    <DoNotDisturbAltIcon
                        className="absolute"
                        color="secondary"
                        fontSize="large"
                        sx={{ opacity: hidePrayers ? 1 : 0 }}
                    />
                </IconButton>
            </Tooltip>

            <Tooltip
                title={
                    showMisconfigurations ? "הסתר פערי איוש" : "הצג פערי איוש"
                }
            >
                <IconButton
                    color={showMisconfigurations ? "warning" : "inherit"}
                    onClick={() => setShowMisconfigurations((v) => !v)}
                >
                    <WarningIcon />
                </IconButton>
            </Tooltip>
        </Box>
    );
}
