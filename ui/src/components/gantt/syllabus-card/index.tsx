import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Card, { CardProps } from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";
import { styled } from "@mui/material/styles";
import { useState } from "react";

import {
    GanttCurriculumId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import {
    SYLLABUS_ANCHOR_PREFIX,
    useGanttSearchNav,
} from "@/components/gantt/curriculum-view/search/GanttSearchNavProvider";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";
import { ModulesTable } from "@/components/gantt/syllabus-card/ModulesTable";
import { SyllabusCardActions } from "@/components/gantt/syllabus-card/SyllabusCardActions";
import { SyllabusCardHeader } from "@/components/gantt/syllabus-card/SyllabusCardHeader";

/**
 * Properties for the {@link SyllabusCard} component.
 */
export type SyllabusCardProps = {
    /** The identifier of the Gantt curriculum context. */
    curriculumId: GanttCurriculumId;

    /** The identifier of the syllabus to display. */
    syllabusId: GanttSyllabusId;

    /** Optional controlled expanded state. If provided, the card is controlled. */
    expanded?: boolean;

    /** Optional callback when expansion state changes. */
    onExpandChange?: (expanded: boolean) => void;
} & Omit<CardProps, "sx">;

const ExpandMore = styled((props: { _expand: boolean } & any) => {
    const { expand: _expand, ...other } = props;
    return <IconButton {...other} />;
})(({ theme, expand }) => ({
    transform: !expand ? "rotate(0deg)" : "rotate(180deg)",
    marginLeft: "auto",
    transition: theme.transitions.create("transform", {
        duration: theme.transitions.duration.shortest,
    }),
}));

/**
 * A collapsible card component displaying syllabus modules and associated actions.
 * 
 * @param props - Component props containing curriculumId and syllabusId.
 * @returns The rendered React element, or null if the syllabus is not loaded.
 */
export function SyllabusCard({
    curriculumId,
    syllabusId,
    expanded: controlledExpanded,
    onExpandChange,
    ...props
}: SyllabusCardProps) {
    const syllabus = useSyllabus(syllabusId);
    const [localExpanded, setLocalExpanded] = useState<boolean>(true);
    const isControlled = controlledExpanded !== undefined;
    const expanded = isControlled ? controlledExpanded : localExpanded;
    const { highlightedSyllabusId } = useGanttSearchNav();
    const isHighlighted = highlightedSyllabusId === syllabusId;

    const handleExpandClick = () => {
        const newExpanded = !expanded;
        if (isControlled) {
            onExpandChange?.(newExpanded);
        } else {
            setLocalExpanded(newExpanded);
        }
    };

    return (
        <Card
            id={`${SYLLABUS_ANCHOR_PREFIX}${syllabusId}`}
            sx={{
                display: "flex",
                flexDirection: "column",
                width: "30%",
                minWidth: 350,
                maxHeight: expanded ? "90%" : "fit-content",
                overflow: "hidden",
                transition:
                    "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.25s ease",
                border: "1px solid transparent",
                ...(isHighlighted && {
                    borderColor: "primary.main",
                    boxShadow:
                        "0 0 0 3px var(--mui-palette-primary-light, rgba(25, 118, 210, 0.4))",
                }),
                "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow:
                        "0 12px 24px -10px rgba(0, 0, 0, 0.15), 0 8px 16px -8px rgba(0, 0, 0, 0.1)",
                    borderColor: "primary.light",
                },
            }}
            {...props}
        >
            <SyllabusCardHeader
                action={
                    <ExpandMore
                        aria-expanded={expanded}
                        aria-label="הצג עוד"
                        expand={expanded}
                        onClick={handleExpandClick}
                    >
                        <ExpandMoreIcon />
                    </ExpandMore>
                }
                onClick={handleExpandClick}
                sx={{
                    pb: 0,
                    pt: 1.5,
                    px: 2,
                    cursor: "pointer",
                    userSelect: "none",
                    "&:hover": {
                        backgroundColor: "rgba(0, 0, 0, 0.04)",
                    },
                }}
                syllabusId={syllabusId}
            />

            <Collapse in={expanded} timeout="auto" unmountOnExit>
                <CardContent
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        paddingY: 1,
                        flex: 1,
                        overflow: "hidden",
                    }}
                >
                    <ModulesTable
                        curriculumId={curriculumId}
                        syllabusId={syllabusId}
                        syllabusModules={syllabus?.modules ?? []}
                    />
                </CardContent>
                <SyllabusCardActions
                    curriculumId={curriculumId}
                    syllabusId={syllabusId}
                />
            </Collapse>
        </Card>
    );
}
