import ChatIcon from "@mui/icons-material/Chat";
import FmdBadIcon from "@mui/icons-material/FmdBad";
import LockIcon from "@mui/icons-material/Lock";
import { Box, BoxProps, Tooltip } from "@mui/material";

import { Event } from "@/components/schedule/types/event";

export function EventStatusIcons({
    event,
    size,
    ...props
}: { event: Event; size: BoxProps["fontSize"] } & BoxProps) {
    const tooltipPlacement = props.flexDirection === "column" ? "left" : "top";
    return (
        <Box
            display={props.display ?? "flex"}
            flexDirection={props.flexDirection ?? "row"}
            flexWrap={"wrap"}
            fontSize={size}
            maxHeight={"100%"}
            overflow={"hidden"}
            position={"relative"}
            sx={{ ...props.sx, direction: "rtl" }}
            {...props}
        >
            {event.locked ? (
                <Tooltip placement={tooltipPlacement} title="מתואם">
                    <LockIcon fontSize={"inherit"} />
                </Tooltip>
            ) : null}
            {event.required ? (
                <Tooltip placement={tooltipPlacement} title="קריטי">
                    <FmdBadIcon fontSize={"inherit"} />
                </Tooltip>
            ) : null}
            {event.personalTalk ? (
                <Tooltip placement={tooltipPlacement} title='חלון פ"א'>
                    <ChatIcon fontSize={"inherit"} />
                </Tooltip>
            ) : null}
        </Box>
    );
}
