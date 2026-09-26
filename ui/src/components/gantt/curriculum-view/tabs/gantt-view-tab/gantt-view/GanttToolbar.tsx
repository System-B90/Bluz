import CalendarViewDayIcon from "@mui/icons-material/CalendarViewDay";
import CalendarViewWeekIcon from "@mui/icons-material/CalendarViewWeek";
import ClearIcon from "@mui/icons-material/Clear";
import PendingActionsIcon from "@mui/icons-material/PendingActions";
import RuleIcon from "@mui/icons-material/Rule";
import SearchIcon from "@mui/icons-material/Search";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import WidthFullIcon from "@mui/icons-material/WidthFull";
import WidthNormalIcon from "@mui/icons-material/WidthNormal";
import ZoomOutMapIcon from "@mui/icons-material/ZoomOutMap";
import Badge from "@mui/material/Badge";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import TextField from "@mui/material/TextField";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { Command, useCommands } from "@system-b90/command-palette";
import React, { useMemo } from "react";

import { COMMAND_GROUPS } from "@/components/app-commands/labels";

export type GanttToolbarProps = {
    title: string;
    description?: string;
    weeklyView: boolean;
    onWeeklyViewChange: (checked: boolean) => void;
    showConstraints: boolean;
    setShowConstraints: (value: boolean) => void;
    showUnallocated: boolean;
    setShowUnallocated: (value: boolean) => void;
    unallocatedCount: number;
    relativeDaySizing: boolean;
    setRelativeDaySizing: (value: boolean) => void;
    allCollapsed: boolean;
    collapseAllSyllabuses: () => void;
    expandAllSyllabuses: () => void;
    zoomedWeekId: null | string;
    setZoomedWeekId: (weekId: null | string) => void;
    searchQuery: string;
    onSearchChange: (value: string) => void;
};

export const GanttToolbar: React.FC<GanttToolbarProps> = ({
    title,
    description,
    weeklyView,
    onWeeklyViewChange,
    showConstraints,
    setShowConstraints,
    showUnallocated,
    setShowUnallocated,
    unallocatedCount,
    relativeDaySizing,
    setRelativeDaySizing,
    allCollapsed,
    collapseAllSyllabuses,
    expandAllSyllabuses,
    zoomedWeekId,
    setZoomedWeekId,
    searchQuery,
    onSearchChange,
}) =>
{
    const theme = useTheme();

    // Palette mirrors of the toolbar controls, calling the same setters.
    const commands = useMemo<Array<Command>>(() => [
        {
            id: "gantt.timeline.view.toggle",
            title: weeklyView ? "תצוגה יומית" : "תצוגה שבועית",
            group: COMMAND_GROUPS.gantt,
            icon: weeklyView ? <CalendarViewDayIcon /> : <CalendarViewWeekIcon />,
            keywords: [ "weekly", "daily", "view", "שבועי", "יומי" ],
            run: () => onWeeklyViewChange(!weeklyView),
        },
        {
            id: "gantt.timeline.constraints.toggle",
            title: showConstraints ? "הסתרת אילוצים" : "הצגת אילוצים",
            group: COMMAND_GROUPS.gantt,
            icon: <RuleIcon />,
            keywords: [ "constraints", "אילוצים" ],
            run: () => setShowConstraints(!showConstraints),
        },
        {
            id: "gantt.timeline.unallocated.toggle",
            title: showUnallocated ? "הסתרת לא משובצים" : "הצגת לא משובצים",
            group: COMMAND_GROUPS.gantt,
            icon: <PendingActionsIcon />,
            keywords: [ "unallocated", "unscheduled", "לא משובצים", "פערים" ],
            run: () => setShowUnallocated(!showUnallocated),
        },
        {
            id: "gantt.timeline.sizing.toggle",
            title: relativeDaySizing ? "בלוקים בתא מלא" : "בלוקים לפי יום",
            group: COMMAND_GROUPS.gantt,
            icon: relativeDaySizing ? <WidthFullIcon /> : <WidthNormalIcon />,
            keywords: [ "block size", "relative", "full", "גודל" ],
            enabled: weeklyView,
            run: () => setRelativeDaySizing(!relativeDaySizing),
        },
        {
            id: "gantt.timeline.collapse.toggle",
            title: allCollapsed ? "להרחיב הכל" : "לכווץ הכל",
            group: COMMAND_GROUPS.gantt,
            icon: allCollapsed ? <UnfoldMoreIcon /> : <UnfoldLessIcon />,
            keywords: [ "expand all", "collapse all", "הרחבה", "כיווץ" ],
            run: allCollapsed ? expandAllSyllabuses : collapseAllSyllabuses,
        },
        {
            id: "gantt.timeline.zoom.reset",
            title: "בחזרה לכל השבועות",
            group: COMMAND_GROUPS.gantt,
            icon: <ZoomOutMapIcon />,
            keywords: [ "zoom out", "all weeks", "שבועות" ],
            enabled: Boolean(zoomedWeekId),
            run: () => setZoomedWeekId(null),
        },
    ], [
        weeklyView, onWeeklyViewChange,
        showConstraints, setShowConstraints,
        showUnallocated, setShowUnallocated,
        relativeDaySizing, setRelativeDaySizing,
        allCollapsed, expandAllSyllabuses, collapseAllSyllabuses,
        zoomedWeekId, setZoomedWeekId,
    ]);
    useCommands(commands);

    return (
        <Box
            sx={ {
                p: 2,
                borderBottom: `1px solid ${theme.vars.palette.divider}`,
                flexShrink: 0,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
            } }
        >
            <Box>
                <Typography variant="h6">
                    { title }
                </Typography>
                <Typography
                    color="text.secondary"
                    variant="body2"
                >
                    { description }
                </Typography>
            </Box>
            <Stack
                alignItems="center"
                direction="row"
                spacing={ 1 }
                sx={ {
                    flexWrap: "wrap",
                    justifyContent: "flex-end",
                    rowGap: 1,
                } }
            >
                {/* First-column search: filter syllabus/module/event rows */ }
                <TextField
                    aria-label="חיפוש בסילבוסים, מודולים ואירועים"
                    onChange={ (ev) => onSearchChange(ev.target.value) }
                    placeholder="חיפוש..."
                    size="small"
                    slotProps={ {
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                            endAdornment: searchQuery ? (
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label="ניקוי חיפוש"
                                        edge="end"
                                        onClick={ () => onSearchChange("") }
                                        size="small"
                                    >
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        },
                    } }
                    sx={ { minWidth: 200 } }
                    value={ searchQuery }
                />

                {/* View mode: weekly / daily */ }
                <ToggleButtonGroup
                    aria-label="מצב תצוגה"
                    exclusive
                    onChange={ (_, value) =>
                    {
                        if (value)
                            onWeeklyViewChange(
                                value === "week",
                            );
                    } }
                    size="small"
                    value={ weeklyView ? "week" : "day" }
                >
                    <ToggleButton
                        aria-label="תצוגה שבועית"
                        sx={ { gap: 0.5, px: 1.5 } }
                        value="week"
                    >
                        <CalendarViewWeekIcon fontSize="small" />
                        שבועי
                    </ToggleButton>
                    <ToggleButton
                        aria-label="תצוגה יומית"
                        sx={ { gap: 0.5, px: 1.5 } }
                        value="day"
                    >
                        <CalendarViewDayIcon fontSize="small" />
                        יומי
                    </ToggleButton>
                </ToggleButtonGroup>

                {/* Display options: constraints / unallocated */ }
                <ToggleButtonGroup
                    aria-label="אפשרויות תצוגה"
                    onChange={ (_, values: Array<string>) =>
                    {
                        setShowConstraints(
                            values.includes("constraints"),
                        );
                        setShowUnallocated(
                            values.includes("unallocated"),
                        );
                    } }
                    size="small"
                    value={ [
                        ...(showConstraints
                            ? [ "constraints" ]
                            : []),
                        ...(showUnallocated
                            ? [ "unallocated" ]
                            : []),
                    ] }
                >
                    <ToggleButton
                        aria-label="הצגת אילוצים"
                        sx={ { gap: 0.5, px: 1.5 } }
                        value="constraints"
                    >
                        <RuleIcon fontSize="small" />
                        אילוצים
                    </ToggleButton>
                    <ToggleButton
                        aria-label="הצגת פערי שיבוץ"
                        sx={ { gap: 0.5, px: 1.5 } }
                        value="unallocated"
                    >
                        <Badge
                            badgeContent={ unallocatedCount }
                            color="warning"
                            max={ 999 }
                            overlap="circular"
                        >
                            <PendingActionsIcon fontSize="small" />
                        </Badge>
                        לא משובצים
                    </ToggleButton>
                </ToggleButtonGroup>

                { weeklyView ? (
                    <ToggleButtonGroup
                        aria-label="גודל בלוקים"
                        exclusive
                        onChange={ (_, value) =>
                        {
                            if (value)
                                setRelativeDaySizing(
                                    value === "relative",
                                );
                        } }
                        size="small"
                        value={
                            relativeDaySizing
                                ? "relative"
                                : "full"
                        }
                    >
                        <ToggleButton
                            aria-label="מילוי מלא של התא"
                            sx={ { gap: 0.5, px: 1.5 } }
                            value="full"
                        >
                            <WidthFullIcon fontSize="small" />
                            תא מלא
                        </ToggleButton>
                        <ToggleButton
                            aria-label="גודל יחסי ליום"
                            sx={ { gap: 0.5, px: 1.5 } }
                            value="relative"
                        >
                            <WidthNormalIcon fontSize="small" />
                            לפי יום
                        </ToggleButton>
                    </ToggleButtonGroup>
                ) : null }

                <Divider flexItem orientation="vertical" />

                {/* Row actions */ }
                <Tooltip
                    title={
                        allCollapsed ? "להרחיב הכל" : "לכווץ הכל"
                    }
                >
                    <IconButton
                        aria-label={
                            allCollapsed ? "להרחיב הכל" : "לכווץ הכל"
                        }
                        onClick={
                            allCollapsed
                                ? expandAllSyllabuses
                                : collapseAllSyllabuses
                        }
                        size="small"
                    >
                        { allCollapsed ? (
                            <UnfoldMoreIcon />
                        ) : (
                            <UnfoldLessIcon />
                        ) }
                    </IconButton>
                </Tooltip>
                { zoomedWeekId ? (
                    <Tooltip title="בחזרה לכל השבועות">
                        <IconButton
                            aria-label="בחזרה לכל השבועות"
                            color="primary"
                            onClick={ () =>
                                setZoomedWeekId(null)
                            }
                            size="small"
                        >
                            <ZoomOutMapIcon />
                        </IconButton>
                    </Tooltip>
                ) : null }
            </Stack>
        </Box>
    );
};
