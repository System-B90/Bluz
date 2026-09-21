import ChatIcon from "@mui/icons-material/Chat";
import DoNotDisturbAltIcon from "@mui/icons-material/DoNotDisturbAlt";
import SynagogueIcon from "@mui/icons-material/Synagogue";
import WarningIcon from "@mui/icons-material/Warning";
import Box, { BoxProps } from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import { useCallback } from "react";

import { useAuth } from "@/components/auth/AuthProvider";
import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { FilterCourses } from "@/components/header/FilterCourses";
import { FilterInstructors } from "@/components/header/FilterInstructor";
import { FilterRoom } from "@/components/header/FilterRoom";

export function Filters({ ...props }: BoxProps)
{
    const {
        showPAsFor,
        setShowPAsFor,
        filteredInstructors,
        hidePrayers,
        setHidePrayers,
        showMisconfigurations,
        setShowMisconfigurations,
    } = useCalendarFilters();
    const { userData } = useAuth();

    // The פ"א view highlights slots where *one* instructor could hold a
    // personal talk, greying out the ones they are already busy in. That
    // instructor is whoever the instructor filter is narrowed to, or the
    // signed-in user — it used to be a hard-coded Hive id, so the "busy"
    // dimming was computed for a stranger and never matched the viewer.
    const paInstructorId =
        filteredInstructors.length === 1
            ? filteredInstructors[ 0 ]
            : Number(userData.id);

    const handleShowPA = useCallback(() =>
    {
        setShowPAsFor((v) => (v === null ? paInstructorId : null));
    }, [ setShowPAsFor, paInstructorId ]);

    return (
        <Box { ...props }>
            <FilterInstructors
                boxSizing={ "border-box" }
                minWidth={ 200 }
                width={ "100%" }
            />
            <FilterCourses
                boxSizing={ "border-box" }
                minWidth={ 200 }
                width={ "100%" }
            />
            <FilterRoom
                boxSizing={ "border-box" }
                minWidth={ 200 }
                width={ "100%" }
            />

            <Box
                alignItems="center"
                display="flex"
                flexDirection="row"
                gap={ 2 }
                justifyContent="center"
                mt={ 0.5 }
            >
                <Tooltip
                    title={
                        showPAsFor !== null ? 'הסתרת חלונות פ"א' : 'גילוי חלונות פ"א'
                    }
                >
                    <IconButton
                        color={ showPAsFor !== null ? "primary" : "inherit" }
                        onClick={ handleShowPA }
                    >
                        <ChatIcon />
                    </IconButton>
                </Tooltip>

                <Tooltip title={ hidePrayers ? "הצגת תפילות" : "הסתרת תפילות" }>
                    <IconButton
                        className="relative"
                        color="inherit"
                        onClick={ () => setHidePrayers((v) => !v) }
                    >
                        <SynagogueIcon
                            sx={ {
                                opacity: hidePrayers ? 0.7 : 1,
                                padding: hidePrayers ? 0.3 : 0,
                            } }
                        />
                        <DoNotDisturbAltIcon
                            className="absolute"
                            color="secondary"
                            fontSize="large"
                            sx={ { opacity: hidePrayers ? 1 : 0 } }
                        />
                    </IconButton>
                </Tooltip>

                <Tooltip
                    title={
                        showMisconfigurations ? "הסתרת פערי איוש" : "הצגת פערי איוש"
                    }
                >
                    <IconButton
                        color={ showMisconfigurations ? "warning" : "inherit" }
                        onClick={ () => setShowMisconfigurations((v) => !v) }
                    >
                        <WarningIcon />
                    </IconButton>
                </Tooltip>
            </Box>
        </Box>
    );
}
