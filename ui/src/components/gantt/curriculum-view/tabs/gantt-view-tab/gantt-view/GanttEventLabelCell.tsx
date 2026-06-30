import Box from "@mui/material/Box";
import { alpha, useTheme } from "@mui/material/styles";
import TableCell from "@mui/material/TableCell";
import Typography from "@mui/material/Typography";
import React from "react";

import { GanttBlock } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttBlock";

type GanttEventLabelCellProps = {
    eventId: string;
    eventTitle: string;
    isRemoveOver: boolean;
    isUnmapped: boolean | null;
    moduleId: string;
    onTitleClick: () => void;
    setRemoveNodeRef: (node: HTMLElement | null) => void;
    violations: Array<string>;
};

export const GanttEventLabelCell: React.FC<GanttEventLabelCellProps> = ({
    eventId,
    eventTitle,
    isRemoveOver,
    isUnmapped,
    moduleId,
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
        </TableCell>
    );
};
