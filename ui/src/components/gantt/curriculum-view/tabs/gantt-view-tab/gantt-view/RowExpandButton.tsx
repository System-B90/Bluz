/**
 * Name: RowExpandButton.tsx
 * Purpose: The expand/collapse toggle of a timeline row (syllabus or module).
 *   A real button, so it is reachable with Tab and announces its state, and
 *   its collapsed chevron points into the content in RTL (#816).
 * Created: 2026-10-03
 * Author: Michael K. Steinberg
 */
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import IconButton from "@mui/material/IconButton";
import { useTheme } from "@mui/material/styles";
import React from "react";

type RowExpandButtonProps = {
    expanded: boolean;
    /** The row's name, for the accessible label ("הרחבת <name>"). */
    name: string;
    onToggle: () => void;
};

export const RowExpandButton: React.FC<RowExpandButtonProps> = ({
    expanded,
    name,
    onToggle,
}) =>
{
    const theme = useTheme();
    // Collapsed points along the reading direction, toward the hidden rows.
    const CollapsedIcon = theme.direction === "rtl" ? ChevronLeftIcon : ChevronRightIcon;

    return (
        <IconButton
            aria-expanded={ expanded }
            aria-label={ `${expanded ? "כיווץ" : "הרחבת"} ${name}` }
            onClick={ (e) =>
            {
                // The syllabus row toggles on click too; one click, one toggle.
                e.stopPropagation();
                onToggle();
            } }
            size="small"
            sx={ { p: 0.25, flexShrink: 0 } }
        >
            { expanded
                ? <ExpandMoreIcon fontSize="small" />
                : <CollapsedIcon fontSize="small" /> }
        </IconButton>
    );
};
