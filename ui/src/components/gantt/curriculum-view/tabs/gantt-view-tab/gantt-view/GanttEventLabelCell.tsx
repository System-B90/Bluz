import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Box from "@mui/material/Box";
import { alpha, useTheme } from "@mui/material/styles";
import TableCell from "@mui/material/TableCell";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import React from "react";

import { GanttBlock } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttBlock";
import { GanttHoursLabel } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttHoursLabel";
import { EventNoteIndicator } from "@/components/gantt/EventNoteIndicator";

type GanttEventLabelCellProps = {
    /** Execution drift (#121): the cut schedule diverged from the plan. */
    drifted?: boolean;
    /** The event's note; shown as a hover icon when set (#773). */
    eventComment?: null | string;
    eventId: string;
    eventTitle: string;
    isRemoveOver: boolean;
    isUnmapped: boolean | null;
    /** Required minutes shown in the hours column (#766). */
    minutes: number;
    moduleId: string;
    /** Mapped, but allotted 0 minutes in total: kept, yet left out of the cut. */
    zeroAllotted?: boolean;
    onTitleClick: () => void;
    setRemoveNodeRef: (node: HTMLElement | null) => void;
    violations: Array<string>;
};

export const GanttEventLabelCell: React.FC<GanttEventLabelCellProps> = ({
    drifted,
    eventComment,
    eventId,
    eventTitle,
    isRemoveOver,
    isUnmapped,
    minutes,
    moduleId,
    zeroAllotted,
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

            <EventNoteIndicator comment={ eventComment } />

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

            { zeroAllotted ? (
                <Tooltip title="לא הוקצה זמן — המופע לא ייכלל בגזירה">
                    <WarningAmberIcon
                        aria-label="לא הוקצה זמן"
                        color="warning"
                        sx={ { flexShrink: 0, fontSize: 16, marginInlineStart: 0.5 } }
                    />
                </Tooltip>
            ) : null }

            <GanttHoursLabel minutes={ minutes } />
        </TableCell>
    );
};
