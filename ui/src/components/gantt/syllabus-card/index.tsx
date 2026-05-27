/**
 * Name: SyllabusCard.tsx
 * Purpose: A collapsible card displaying syllabus modules and actions.
 * Created: 2026-04-14
 * Author: Michael K. Steinberg
 */

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import {
    Card,
    CardContent,
    CardProps,
    Collapse,
    IconButton,
} from "@mui/material";
import { styled } from "@mui/material/styles";
import { useState } from "react";

import {
    GanttCurriculumId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";
import { ModulesTable } from "@/components/gantt/syllabus-card/ModulesTable";
import { SyllabusCardActions } from "@/components/gantt/syllabus-card/SyllabusCardActions";
import { SyllabusCardHeader } from "@/components/gantt/syllabus-card/SyllabusCardHeader";

export type SyllabusCardProps = {
  curriculumId: GanttCurriculumId;
  syllabusId: GanttSyllabusId;
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

export function SyllabusCard({
    curriculumId,
    syllabusId,
    ...props
}: SyllabusCardProps) {
    const syllabus = useSyllabus(syllabusId);
    const [expanded, setExpanded] = useState<boolean>(true);

    const handleExpandClick = () => {
        setExpanded(!expanded);
    };

    return (
        <Card
            sx={{
                display: "flex",
                flexDirection: "column",
                width: "30%",
                minWidth: 350,
                maxHeight: expanded ? "90%" : "fit-content",
                overflow: "hidden",
            }}
            {...props}
        >
            <SyllabusCardHeader
                action={
                    <ExpandMore
                        aria-expanded={expanded}
                        aria-label="show more"
                        expand={expanded}
                        onClick={handleExpandClick}
                    >
                        <ExpandMoreIcon />
                    </ExpandMore>
                }
                sx={{ pb: 0, pt: 1.5, px: 2 }}
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
