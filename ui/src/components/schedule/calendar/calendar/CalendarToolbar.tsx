import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import EventIcon from "@mui/icons-material/Event";
import FilterListIcon from "@mui/icons-material/FilterList";
import FullscreenIcon from "@mui/icons-material/Fullscreen";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import WifiTetheringIcon from "@mui/icons-material/WifiTethering";
import WifiTetheringOffIcon from "@mui/icons-material/WifiTetheringOff";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import ButtonGroup from "@mui/material/ButtonGroup";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import Popover from "@mui/material/Popover";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import dayjs from "dayjs";
import { useCallback, useMemo, useState } from "react";
import { ToolbarProps } from "react-big-calendar";

import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { useOffline } from "@/components/base/OfflineProvider";
import { CALENDAR_MESSAGES } from "@/components/CalendarMessages";
import { Filters } from "@/components/header/filters";
import { DraftsMenu } from "@/components/schedule/calendar/calendar/DraftsMenu";
import { IterationSelector } from "@/components/schedule/calendar/calendar/IterationSelector";
import { SnapshotMenu } from "@/components/schedule/calendar/calendar/SnapshotMenu";
import
{
    CONTROL_BUTTON_SX,
    PULSING_ICON_BUTTON_SX,
} from "@/components/schedule/calendar/calendar/toolbar-button-sx";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import { EventSegment } from "@/components/schedule/calendar/split/segments";

/**
 * Custom header toolbar for the calendar containing navigation controls, a date picker, and view selectors.
 * 
 * @param props - React-big-calendar toolbar props and custom layout state callbacks.
 * @returns The rendered CalendarToolbar component.
 */
export function CalendarToolbar({
    date,
    label,
    onNavigate,
    onView,
    view,
    showToolbar,
    onToggleFullscreen,
    onToggleToolbar,
    onExportIcs,
}: ToolbarProps<EventSegment, object> & {
    showToolbar: boolean;
    onToggleFullscreen: () => void;
    onToggleToolbar: () => void;
    onExportIcs: () => void;
})
{
    const { offlineMode, setOfflineMode } = useOffline();
    const { startDate, endDate } = useCalendar();
    const { showPAsFor, filteredCourses, filteredInstructors, hidePrayers } =
        useCalendarFilters();
    const [ open, setOpen ] = useState(false);
    const [ filterAnchorEl, setFilterAnchorEl ] =
        useState<HTMLButtonElement | null>(null);
    const filterOpen = Boolean(filterAnchorEl);

    const hasAnyFilter = useMemo(
        () =>
            hidePrayers ||
            filteredCourses.length !== 0 ||
            filteredInstructors.length !== 0 ||
            showPAsFor !== null,
        [ filteredCourses, filteredInstructors, showPAsFor, hidePrayers ],
    );

    const handleDateChange = useCallback(
        (val: dayjs.Dayjs | null) =>
        {
            if (val && val.isValid())
            {
                onNavigate("DATE", val.toDate());
            }
        },
        [ onNavigate ],
    );

    const isTodayShown = useMemo(() =>
    {
        const today = dayjs();
        const calendarDate = dayjs(date);
        if (view === "day")
        {
            return calendarDate.isSame(today, "day");
        }
        if (view === "week")
        {
            const start = calendarDate.day(0).startOf("day");
            const end = calendarDate.day(6).endOf("day");
            return (
                (today.isSame(start) || today.isAfter(start)) &&
                (today.isSame(end) || today.isBefore(end))
            );
        }
        if (view === "work_week")
        {
            const start = calendarDate.day(0).startOf("day");
            const end = calendarDate.day(4).endOf("day");
            return (
                (today.isSame(start) || today.isAfter(start)) &&
                (today.isSame(end) || today.isBefore(end))
            );
        }
        return false;
    }, [ date, view ]);

    return (
        <Collapse in={ showToolbar }>
            <Box
                alignItems="center"
                display="flex"
                flexWrap="wrap"
                gap={ 2 }
                justifyContent="space-between"
                px={ 2 }
                py={ 1.5 }
                sx={ {
                    position: "relative",
                    borderBottom: "1px solid",
                    borderColor: "divider",
                    bgcolor: (theme) =>
                        theme.palette.mode === "dark"
                            ? "background.default"
                            : "transparent",
                } }
                width="100%"
            >
                <Box
                    alignItems="center"
                    display="flex"
                    flexWrap="wrap"
                    gap={ 1.5 }
                >
                    <ButtonGroup size="small" sx={ { "& .MuiButton-root": { height: 32 } } } variant="outlined">
                        <Button onClick={ () => onNavigate("PREV") }>
                            { CALENDAR_MESSAGES.previous }
                        </Button>
                        <Button
                            onClick={ () => onNavigate("TODAY") }
                            variant={ isTodayShown ? "contained" : "outlined" }
                        >
                            { CALENDAR_MESSAGES.today }
                        </Button>
                        <Button onClick={ () => onNavigate("NEXT") }>
                            { CALENDAR_MESSAGES.next }
                        </Button>
                    </ButtonGroup>
                    <IterationSelector />
                </Box>

                <Box
                    alignItems="center"
                    display="flex"
                    gap={ 1 }
                    sx={ {
                        // Absolute centering starts at `lg`: between 900 and
                        // ~1150px the navigation and action groups beside it
                        // are wide enough to collide with the title (#653).
                        position: { xs: "static", lg: "absolute" },
                        // Physical `left` on purpose: centering is
                        // direction-agnostic, but pairing the *logical* inset
                        // with a physical translate moves the box the same way
                        // twice under RTL and throws the title off-centre.
                        left: { lg: "50%" },
                        transform: { lg: "translateX(-50%)" },
                    } }
                >
                    <Typography
                        fontWeight="bold"
                        sx={ { color: "text.primary" } }
                        variant="h6"
                    >
                        { label }
                    </Typography>
                    <IconButton
                        onClick={ () => setOpen(true) }
                        size="small"
                        sx={ {
                            color: "text.secondary",
                            transition: "all 0.2s ease-in-out",
                            "&:hover": {
                                color: "primary.main",
                                transform: "scale(1.1)",
                            },
                            "&:active": {
                                transform: "scale(0.95)",
                            },
                        } }
                    >
                        <CalendarTodayIcon fontSize="small" />
                    </IconButton>
                    <DatePicker
                        format="DD/MM/YYYY"
                        onChange={ (val) =>
                        {
                            handleDateChange(val);
                            setOpen(false);
                        } }
                        onClose={ () => setOpen(false) }
                        open={ open }
                        slotProps={ {
                            textField: {
                                sx: {
                                    position: "absolute",
                                    width: 0,
                                    height: 0,
                                    opacity: 0,
                                    pointerEvents: "none",
                                },
                            },
                        } }
                        value={ dayjs(date) }
                    />
                </Box>

                <Box alignItems="center" display="flex" gap={ 1.5 }>
                    <ButtonGroup size="small" sx={ { "& .MuiButton-root": { height: 32 } } } variant="outlined">
                        <DraftsMenu />
                        <SnapshotMenu />
                        <Tooltip title="ייצוא לוח הזמנים המוצג ל-ICS">
                            <Button
                                disabled={ !startDate || !endDate }
                                onClick={ onExportIcs }
                                sx={ { minWidth: 38 } }
                            >
                                <EventIcon fontSize="small" />
                            </Button>
                        </Tooltip>
                    </ButtonGroup>
                    <ButtonGroup size="small" sx={ { "& .MuiButton-root": { height: 32 } } } variant="outlined">
                        <Button
                            onClick={ () => onView("day") }
                            variant={ view === "day" ? "contained" : "outlined" }
                        >
                            { CALENDAR_MESSAGES.day }
                        </Button>
                        <Button
                            onClick={ () => onView("work_week") }
                            variant={
                                view === "work_week" ? "contained" : "outlined"
                            }
                        >
                            { CALENDAR_MESSAGES.work_week }
                        </Button>
                        <Button
                            onClick={ () => onView("week") }
                            variant={ view === "week" ? "contained" : "outlined" }
                        >
                            { CALENDAR_MESSAGES.week }
                        </Button>
                    </ButtonGroup>

                    <ButtonGroup size="small" sx={ { "& .MuiButton-root": { height: 32 } } } variant="outlined">
                        <Tooltip
                            title={
                                offlineMode ? "חזור למצב מקוון" : "עבור למצב לוקלי"
                            }
                        >
                            <Button
                                color={ offlineMode ? "warning" : "primary" }
                                onClick={ () => setOfflineMode((v) => !v) }
                                size="small"
                                sx={ {
                                    minWidth: 38,
                                    transition: "all 0.2s ease-in-out",
                                    "&:active": { transform: "scale(0.95)" },
                                } }
                                variant={ offlineMode ? "contained" : "outlined" }
                            >
                                { offlineMode ? (
                                    <WifiTetheringOffIcon fontSize="small" />
                                ) : (
                                    <WifiTetheringIcon fontSize="small" />
                                ) }
                            </Button>
                        </Tooltip>

                        <Tooltip
                            title={ filterOpen ? "הסתרת סננים" : "הצגת סננים" }
                        >
                            <Button
                                color="primary"
                                onClick={ (e) =>
                                    setFilterAnchorEl(e.currentTarget)
                                }
                                size="small"
                                sx={ {
                                    minWidth: 38,
                                    position: "relative",
                                    transition: "all 0.2s ease-in-out",
                                    ...(filterOpen || hasAnyFilter
                                        ? {
                                            bgcolor: "primary.main",
                                            color: "primary.contrastText",
                                            "&:hover": {
                                                bgcolor: "primary.dark",
                                            },
                                        }
                                        : {}),
                                    "&:active": { transform: "scale(0.95)" },
                                } }
                                variant="outlined"
                            >
                                <FilterListIcon fontSize="small" />
                            </Button>
                        </Tooltip>
                    </ButtonGroup>
                    <Popover
                        anchorEl={ filterAnchorEl }
                        anchorOrigin={ {
                            vertical: "bottom",
                            // The UI is RTL: hang the panel from the anchor's
                            // start (right) edge so it opens inward.
                            horizontal: "right",
                        } }
                        onClose={ () => setFilterAnchorEl(null) }
                        open={ filterOpen }
                        slotProps={ {
                            paper: {
                                sx: {
                                    p: 2,
                                    mt: 1,
                                    borderRadius: "12px",
                                    boxShadow:
                                        "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",
                                },
                            },
                        } }
                        transformOrigin={ {
                            vertical: "top",
                            horizontal: "right",
                        } }
                    >
                        <Filters
                            display="flex"
                            flexDirection="column"
                            gap={ 2 }
                            sx={ { minWidth: 240 } }
                        />
                    </Popover>

                    <ButtonGroup size="small" sx={ { "& .MuiButton-root": { height: 32 } } } variant="outlined">
                        <Tooltip title="הסתרת סרגל כלים">
                            <Button
                                onClick={ onToggleToolbar }
                                sx={ { minWidth: 38, ...CONTROL_BUTTON_SX } }
                            >
                                <VisibilityOffIcon fontSize="small" />
                            </Button>
                        </Tooltip>
                        <Tooltip title="מסך מלא">
                            <Button
                                onClick={ onToggleFullscreen }
                                sx={ { minWidth: 38, ...PULSING_ICON_BUTTON_SX } }
                            >
                                <FullscreenIcon fontSize="small" />
                            </Button>
                        </Tooltip>
                    </ButtonGroup>
                </Box>
            </Box>
        </Collapse>
    );
}
