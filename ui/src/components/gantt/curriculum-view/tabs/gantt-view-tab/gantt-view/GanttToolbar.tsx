import CalendarViewDayIcon from "@mui/icons-material/CalendarViewDay";
import CalendarViewWeekIcon from "@mui/icons-material/CalendarViewWeek";
import ClearIcon from "@mui/icons-material/Clear";
import FreeBreakfastIcon from "@mui/icons-material/FreeBreakfast";
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
import React, { useMemo, useState } from "react";

import { COMMAND_GROUPS } from "@/components/app-commands/labels";
import { GanttFilterButton } from "@/components/gantt/curriculum-view/components/syllabuses-actions-box/GanttFilterButton";
import { GanttLegend } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttLegend";

const TOGGLE_SX = { gap: 0.5, px: 1.5 } as const;

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
    ignoreBreaks: boolean;
    setIgnoreBreaks: (value: boolean) => void;
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
    ignoreBreaks,
    setIgnoreBreaks,
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

    // Filtering the whole tree per keystroke is heavy: hold the text locally and
    // apply it on blur/Enter; external changes to the query flow back in.
    const [ searchDraft, setSearchDraft ] = useState(searchQuery);
    const [ syncedQuery, setSyncedQuery ] = useState(searchQuery);
    if (syncedQuery !== searchQuery)
    {
        setSyncedQuery(searchQuery);
        setSearchDraft(searchQuery);
    }
    const [ searchFocused, setSearchFocused ] = useState(false);
    const commitSearch = () => onSearchChange(searchDraft);

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
            id: "gantt.timeline.breaks.toggle",
            title: ignoreBreaks ? "הצגת הפסקות בסכומי הזמן" : "התעלמות מהפסקות בסכומי הזמן",
            group: COMMAND_GROUPS.gantt,
            icon: <FreeBreakfastIcon />,
            keywords: [ "breaks", "ignore breaks", "הפסקות" ],
            run: () => setIgnoreBreaks(!ignoreBreaks),
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
        ignoreBreaks, setIgnoreBreaks,
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
                    aria-label="חיפוש בסילבוסים, מערכים ומופעים"
                    onBlur={ () =>
                    {
                        setSearchFocused(false);
                        commitSearch();
                    } }
                    onChange={ (ev) => setSearchDraft(ev.target.value) }
                    onFocus={ () => setSearchFocused(true) }
                    onKeyDown={ (ev) => { if (ev.key === "Enter") commitSearch(); } }
                    placeholder="חיפוש..."
                    size="small"
                    slotProps={ {
                        input: {
                            startAdornment: (
                                <InputAdornment position="start">
                                    <SearchIcon fontSize="small" />
                                </InputAdornment>
                            ),
                            endAdornment: searchDraft ? (
                                <InputAdornment position="end">
                                    <IconButton
                                        aria-label="ניקוי חיפוש"
                                        edge="end"
                                        onClick={ () =>
                                        {
                                            setSearchDraft("");
                                            onSearchChange("");
                                        } }
                                        size="small"
                                    >
                                        <ClearIcon fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ) : null,
                        },
                    } }
                    sx={ {
                        width: searchFocused ? 420 : 280,
                        maxWidth: "100%",
                        transition: theme.transitions.create("width"),
                    } }
                    value={ searchDraft }
                />

                <GanttFilterButton withCommand={ false } />

                {/* Accessible names are the visible text (WCAG 2.5.3, #815); the
                    longer explanation is the tooltip, exposed as a description. */ }
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
                    <Tooltip describeChild title="תצוגה שבועית">
                        <ToggleButton sx={ TOGGLE_SX } value="week">
                            <CalendarViewWeekIcon fontSize="small" />
                            שבועי
                        </ToggleButton>
                    </Tooltip>
                    <Tooltip describeChild title="תצוגה יומית">
                        <ToggleButton sx={ TOGGLE_SX } value="day">
                            <CalendarViewDayIcon fontSize="small" />
                            יומי
                        </ToggleButton>
                    </Tooltip>
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
                        setIgnoreBreaks(values.includes("breaks"));
                    } }
                    size="small"
                    value={ [
                        ...(showConstraints
                            ? [ "constraints" ]
                            : []),
                        ...(showUnallocated
                            ? [ "unallocated" ]
                            : []),
                        ...(ignoreBreaks
                            ? [ "breaks" ]
                            : []),
                    ] }
                >
                    <Tooltip describeChild title="הצגת אילוצים וחריגות מהשעות הזמינות">
                        <ToggleButton sx={ TOGGLE_SX } value="constraints">
                            <RuleIcon fontSize="small" />
                            אילוצים
                        </ToggleButton>
                    </Tooltip>
                    <Tooltip describeChild title="הצגת פערי שיבוץ">
                        <ToggleButton sx={ TOGGLE_SX } value="unallocated">
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
                    </Tooltip>
                    <Tooltip describeChild title="התעלמות מהפסקות בסכומי הזמן">
                        <ToggleButton sx={ TOGGLE_SX } value="breaks">
                            <FreeBreakfastIcon fontSize="small" />
                            ללא הפסקות
                        </ToggleButton>
                    </Tooltip>
                </ToggleButtonGroup>

                {/* Block sizing only applies to the weekly view. It stays in
                    place, disabled, in the daily view so the controls after it
                    don't jump when the view switches (#820). */ }
                <ToggleButtonGroup
                    aria-label="גודל בלוקים"
                    disabled={ !weeklyView }
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
                    <ToggleButton sx={ TOGGLE_SX } value="full">
                        <WidthFullIcon fontSize="small" />
                        תא מלא
                    </ToggleButton>
                    <ToggleButton sx={ TOGGLE_SX } value="relative">
                        <WidthNormalIcon fontSize="small" />
                        לפי יום
                    </ToggleButton>
                </ToggleButtonGroup>

                <GanttLegend />

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
