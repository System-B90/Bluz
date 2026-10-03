import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Popover from "@mui/material/Popover";
import Stack from "@mui/material/Stack";
import { alpha, useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import React, { useId, useState } from "react";

const LegendRow: React.FC<{ mark: React.ReactNode; text: string }> = ({ mark, text }) => (
    <Stack alignItems="center" direction="row" gap={ 1 }>
        <Box
            sx={ {
                width: 28,
                display: "flex",
                justifyContent: "center",
                flexShrink: 0,
            } }
        >
            { mark }
        </Box>
        <Typography variant="body2">{ text }</Typography>
    </Stack>
);

/**
 * What the timeline's marks mean (#812, #822): the week ⚠, the amber dot, the
 * tinted day column and the unlabelled `X / Y` hours pair.
 */
export const GanttLegend: React.FC = () =>
{
    const theme = useTheme();
    const [ anchor, setAnchor ] = useState<HTMLElement | null>(null);
    const popoverId = useId();
    const tint = alpha(theme.palette.error.main, 0.12);

    return (
        <>
            <Button
                aria-controls={ anchor ? popoverId : undefined }
                aria-expanded={ Boolean(anchor) }
                aria-haspopup="dialog"
                color="inherit"
                onClick={ (event) => setAnchor(event.currentTarget) }
                size="small"
                startIcon={ <InfoOutlinedIcon fontSize="small" /> }
            >
                מקרא
            </Button>
            <Popover
                anchorEl={ anchor }
                anchorOrigin={ { vertical: "bottom", horizontal: "center" } }
                id={ popoverId }
                onClose={ () => setAnchor(null) }
                open={ Boolean(anchor) }
                slotProps={ { paper: { "aria-label": "מקרא", role: "dialog" } } }
                transformOrigin={ { vertical: "top", horizontal: "center" } }
            >
                <Stack gap={ 1 } sx={ { p: 2, maxWidth: 340 } }>
                    <LegendRow
                        mark={ (
                            <Typography
                                fontWeight={ 700 }
                                sx={ { fontVariantNumeric: "tabular-nums" } }
                                variant="caption"
                            >
                                X / Y
                            </Typography>
                        ) }
                        text="שעות משובצות / שעות זמינות"
                    />
                    <LegendRow
                        mark={ <WarningAmberIcon color="error" sx={ { fontSize: 16 } } /> }
                        text="השבוע כולו חורג מהשעות הזמינות"
                    />
                    <LegendRow
                        mark={ <FiberManualRecordIcon color="warning" sx={ { fontSize: 10 } } /> }
                        text="יום בשבוע חורג, אבל השבוע עוד מכיל את השעות"
                    />
                    <LegendRow
                        mark={ (
                            <Box
                                sx={ {
                                    width: 20,
                                    height: 14,
                                    borderRadius: 0.5,
                                    backgroundColor: tint,
                                    border: `1px solid ${theme.vars.palette.divider}`,
                                } }
                            />
                        ) }
                        text="תצוגה יומית: יום שחורג מהשעות הזמינות בו"
                    />
                </Stack>
            </Popover>
        </>
    );
};
