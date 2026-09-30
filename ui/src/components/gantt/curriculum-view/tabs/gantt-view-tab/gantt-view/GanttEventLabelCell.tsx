import CallSplitIcon from "@mui/icons-material/CallSplit";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import { alpha, useTheme } from "@mui/material/styles";
import TableCell from "@mui/material/TableCell";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";

import { GanttBlock } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttBlock";
import { GanttHoursLabel } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttHoursLabel";

type GanttEventLabelCellProps = {
    /** Execution drift (#121): the cut schedule diverged from the plan. */
    drifted?: boolean;
    eventId: string;
    eventTitle: string;
    isRemoveOver: boolean;
    isUnmapped: boolean | null;
    /** Required minutes shown in the hours column (#766). */
    minutes: number;
    moduleId: string;
    /** Opens the week-split editor; absent when the event cannot split (#768). */
    onSplitClick?: () => void;
    /** Whether the event currently runs split across weeks (#768). */
    isWeekSplit?: boolean;
    onTitleClick: () => void;
    setRemoveNodeRef: (node: HTMLElement | null) => void;
    violations: Array<string>;
};

export const GanttEventLabelCell: React.FC<GanttEventLabelCellProps> = ({
    drifted,
    eventId,
    eventTitle,
    isRemoveOver,
    isUnmapped,
    minutes,
    moduleId,
    onSplitClick,
    isWeekSplit,
    onTitleClick,
    setRemoveNodeRef,
    violations,
}) =>
{
    const theme = useTheme();

    return (
        <TableCell
            ref={ setRemoveNodeRef }
            sx={ {
                pl: 8,
                width: 250,
                minWidth: 250,
                maxWidth: 250,
                boxSizing: "border-box",
                position: "sticky",
                left: 0,
                zIndex: 5,
                backgroundColor: isRemoveOver
                    ? alpha(theme.palette.error.main, 0.08)
                    : theme.vars.palette.background.paper,
                borderRight: `1px solid ${theme.vars.palette.divider}`,
                transition: "background-color 0.2s",
                display: "flex",
                alignItems: "center",
                height: "100%",
            } }
        >
            <Typography
                color="text.secondary"
                noWrap
                onClick={ onTitleClick }
                sx={ {
                    display: "block",
                    cursor: "pointer",
                    "&:hover": {
                        color: "primary.main",
                        textDecoration: "underline",
                    },
                } }
                title="עריכת המופע"
                variant="caption"
            >
                ↳ { eventTitle }
            </Typography>

            { drifted ? (
                <Tooltip title="ביצוע שונה מהתכנון">
                    <Box
                        sx={ {
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            backgroundColor: theme.palette.warning.main,
                            flexShrink: 0,
                            marginInlineStart: 0.75,
                        } }
                    />
                </Tooltip>
            ) : null }

            { isUnmapped ? (
                <Box
                    sx={ {
                        flexGrow: 1,
                        position: "relative",
                        ml: 1,
                        height: "24px",
                    } }
                >
                    <GanttBlock
                        elementId={ `block-event-${eventId}` }
                        id={ `drag-event-unmapped-${eventId}` }
                        isAbsolute={ false }
                        payload={ { type: "event-map", moduleId, eventId } }
                        title={ eventTitle }
                        violations={ violations }
                    />
                </Box>
            ) : null }

            { onSplitClick ? (
                <Tooltip title={ isWeekSplit ? "עריכת פיצול בין שבועות" : "פיצול בין שבועות" }>
                    <IconButton
                        aria-label="פיצול בין שבועות"
                        color={ isWeekSplit ? "primary" : "default" }
                        onClick={ onSplitClick }
                        size="small"
                        sx={ { flexShrink: 0, p: 0.25, marginInlineStart: 0.5 } }
                    >
                        <CallSplitIcon sx={ { fontSize: 16 } } />
                    </IconButton>
                </Tooltip>
            ) : null }

            <GanttHoursLabel minutes={ minutes } />
        </TableCell>
    );
};
