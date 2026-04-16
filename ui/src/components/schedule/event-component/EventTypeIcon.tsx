import CoPresentIcon from '@mui/icons-material/CoPresent';
import EmojiFoodBeverageIcon from '@mui/icons-material/EmojiFoodBeverage';
import QuizIcon from '@mui/icons-material/Quiz';
import SchoolIcon from '@mui/icons-material/School';
import SynagogueIcon from '@mui/icons-material/Synagogue';
import { Box, SvgIconProps, Tooltip } from "@mui/material";
import { ReactNode } from "react";

import { Event, eventTypeToHebrew } from "@/components/schedule/types/event";

export function EventTypeIcon({ event, ...props }: { event: Event; } & SvgIconProps)
{
    let icon: ReactNode = undefined;
    switch (event.type)
    {
        case "exercise":
            icon = <CoPresentIcon { ...props } />;
            break;
        case "lecture":
            icon = <SchoolIcon { ...props } />;
            break;
        case "other":
            icon = <QuizIcon { ...props } />;
            break;
        case "break":
            icon = <EmojiFoodBeverageIcon { ...props } />;
            break;
        case "prayer":
            icon = <SynagogueIcon { ...props } />;
            break;
        default:
            break;
    }
    return (
        <Box>
            { icon ? <Tooltip title={ eventTypeToHebrew(event.type) }>
                { icon }
            </Tooltip> : null }
        </Box>
    );
}
