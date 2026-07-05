"use client";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Accordion from "@mui/material/Accordion";
import AccordionDetails from "@mui/material/AccordionDetails";
import AccordionSummary from "@mui/material/AccordionSummary";
import Box from "@mui/material/Box";
import Stack from "@mui/material/Stack";
import { styled } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { ReactNode, useState } from "react";

const SectionAccordion = styled(Accordion)(({ theme }) => ({
    border: "1px solid",
    borderColor: (theme.vars ?? theme).palette.divider,
    borderRadius: 12,
    backgroundImage: "none",
    boxShadow: "none",
    overflow: "hidden",
    transition: theme.transitions.create([ "border-color", "box-shadow" ], {
        duration: theme.transitions.duration.shorter,
    }),
    "&:before": { display: "none" },
    "&:hover": {
        borderColor: `rgba(${(theme.vars ?? theme).palette.primary.mainChannel} / 0.5)`,
    },
    "&.Mui-expanded": {
        borderColor: `rgba(${(theme.vars ?? theme).palette.primary.mainChannel} / 0.5)`,
        boxShadow: theme.shadows[ 1 ],
    },
}));

/**
 * A quiet, self-contained accordion for the event dialog's optional field
 * groups. When collapsed, the `chips` summarize the group's state so the
 * user can tell at a glance whether anything is set without expanding.
 */
export function CollapsibleSection({
    title,
    icon,
    chips,
    defaultExpanded = false,
    children,
}: {
    title: string;
    icon: ReactNode;
    /** Summary chips shown while collapsed (hidden when expanded). */
    chips?: ReactNode;
    defaultExpanded?: boolean;
    children: ReactNode;
})
{
    const [ expanded, setExpanded ] = useState(defaultExpanded);

    return (
        <SectionAccordion
            disableGutters
            expanded={ expanded }
            onChange={ (_, next) => setExpanded(next) }
            square
        >
            <AccordionSummary expandIcon={ <ExpandMoreIcon /> }>
                <Stack
                    alignItems="center"
                    direction="row"
                    flexGrow={ 1 }
                    spacing={ 1.5 }
                    sx={ { paddingInlineEnd: 1.5, minWidth: 0 } }
                >
                    <Box
                        sx={ {
                            color: "primary.dark",
                            display: "flex",
                            "& svg": { fontSize: 20 },
                        } }
                    >
                        { icon }
                    </Box>
                    <Typography sx={ { fontWeight: 600 } } variant="subtitle1">
                        { title }
                    </Typography>
                    <Stack
                        direction="row"
                        spacing={ 0.75 }
                        sx={ {
                            marginInlineStart: "auto",
                            minWidth: 0,
                            overflow: "hidden",
                            opacity: expanded ? 0 : 1,
                            transition: (theme) =>
                                theme.transitions.create("opacity", {
                                    duration: theme.transitions.duration.shorter,
                                }),
                        } }
                    >
                        { chips }
                    </Stack>
                </Stack>
            </AccordionSummary>
            <AccordionDetails sx={ { pt: 0.5 } }>{ children }</AccordionDetails>
        </SectionAccordion>
    );
}
