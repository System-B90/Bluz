import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import React from "react";

export type GanttUnallocatedGroup = {
    syllabusId: string;
    syllabusTitle: string;
    modules: Array<{ id: string; title: string }>;
    events: Array<{ id: string; title: string; moduleId: string }>;
};

export type GanttUnallocatedPanelProps = {
    unallocatedBySyllabus: Array<GanttUnallocatedGroup>;
    onReveal: (syllabusId: string, moduleId: string, eventId?: string) => void;
};

export const GanttUnallocatedPanel: React.FC<GanttUnallocatedPanelProps> = ({
    unallocatedBySyllabus,
    onReveal,
}) =>
{
    const theme = useTheme();

    return (
        <Box
            sx={ {
                px: 2,
                py: 1.5,
                borderBottom: `1px solid ${theme.vars.palette.divider}`,
                backgroundColor:
                    theme.vars.palette.background.paper,
                flexShrink: 0,
                maxHeight: 200,
                overflow: "auto",
            } }
        >
            { unallocatedBySyllabus.length === 0 ? (
                <Typography
                    color="text.secondary"
                    variant="body2"
                >
                    כל המערכים והמפגשים משובצים 🎉
                </Typography>
            ) : (
                <Stack spacing={ 1 }>
                    { unallocatedBySyllabus.map((group) => (
                        <Box key={ group.syllabusId }>
                            <Typography
                                fontWeight="bold"
                                variant="caption"
                            >
                                { group.syllabusTitle }
                            </Typography>
                            <Box
                                sx={ {
                                    display: "flex",
                                    flexWrap: "wrap",
                                    gap: 0.5,
                                    mt: 0.5,
                                } }
                            >
                                { group.modules.map((m) => (
                                    <Chip
                                        clickable
                                        color="primary"
                                        key={ m.id }
                                        label={ m.title }
                                        onClick={ () =>
                                            onReveal(
                                                group.syllabusId,
                                                m.id,
                                            )
                                        }
                                        size="small"
                                        variant="outlined"
                                    />
                                )) }
                                { group.events.map((e) => (
                                    <Chip
                                        clickable
                                        key={ e.id }
                                        label={ e.title }
                                        onClick={ () =>
                                            onReveal(
                                                group.syllabusId,
                                                e.moduleId,
                                                e.id,
                                            )
                                        }
                                        size="small"
                                        variant="outlined"
                                    />
                                )) }
                            </Box>
                        </Box>
                    )) }
                </Stack>
            ) }
        </Box>
    );
};
