import CoPresentIcon from "@mui/icons-material/CoPresent";
import EmojiFoodBeverageIcon from "@mui/icons-material/EmojiFoodBeverage";
import QuizIcon from "@mui/icons-material/Quiz";
import SchoolIcon from "@mui/icons-material/School";
import SynagogueIcon from "@mui/icons-material/Synagogue";
import { Box, SvgIconProps, Tooltip } from "@mui/material";
import { ReactNode } from "react";

import { Event, EventType, eventTypeToHebrew } from "@/components/schedule/types/event";

export function EventTypeIcon({
    event,
    ...props
}: { event: Event } & SvgIconProps) {
    let icon: ReactNode = undefined;
    switch (event.type) {
    case EventType.EXERCISE:
        icon = <CoPresentIcon {...props} />;
        break;
    case EventType.LECTURE:
        icon = <SchoolIcon {...props} />;
        break;
    case EventType.OTHER:
        icon = <QuizIcon {...props} />;
        break;
    case EventType.BREAK:
        icon = <EmojiFoodBeverageIcon {...props} />;
        break;
    case EventType.PRAYER:
        icon = <SynagogueIcon {...props} />;
        break;
    default:
        break;
    }
    return (
        <Box>
            {icon ? (
                <Tooltip title={eventTypeToHebrew(event.type)}>{icon}</Tooltip>
            ) : null}
        </Box>
    );
}
