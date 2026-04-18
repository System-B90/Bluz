import { Box, Typography } from "@mui/material";
import { EventProps } from "react-big-calendar";

import { EventDurationLabel } from "@/components/schedule/event-component/EventDurationLabel";
import { EventStatusIcons } from "@/components/schedule/event-component/EventStatusIcons";
import { InstructorsList } from "@/components/schedule/event-component/parts/person";
import { RoomComponent } from "@/components/schedule/event-component/parts/room";
import { Event } from "@/components/schedule/types/event";

export function TinyEventComponent({ event: event }: EventProps<Event>) {
    return (
        <Box
            alignItems={"center"}
            display={"flex"}
            height={"100%"}
            justifyContent={"space-around"}
        >
            <Box
                alignItems={"center"}
                display={"flex"}
                flexGrow={1}
                justifyContent={"space-around"}
            >
                <Box marginTop={0} paddingTop={0} sx={{ marginTop: "0 !important" }}>
                    <Typography
                        noWrap
                        sx={{ ml: 0.5, fontWeight: "bold" }}
                        variant="subtitle2"
                    >
                        {event.name}
                    </Typography>
                </Box>

                <Box
                    alignItems={"stretch"}
                    display={"flex"}
                    flexGrow={1}
                    flexWrap={"wrap"}
                    gap={0.1}
                    justifyContent={"center"}
                    marginTop={0}
                    paddingTop={0}
                    sx={{ marginTop: "0 !important" }}
                >
                    <InstructorsList
                        chipSize="smallest"
                        display={"flex"}
                        event={event}
                        flexDirection={"column"}
                        showCaption={false}
                    />
                    <Box
                        alignContent={"center"}
                        alignItems={"center"}
                        display={"flex"}
                        justifyContent={"center"}
                        sx={{ width: "0.3rem" }}
                    >
                        <Box
                            sx={{ height: "90%", width: "1px", backgroundColor: "divider" }}
                        />
                    </Box>
                    <RoomComponent
                        chipSize="smallest"
                        display={"flex"}
                        flexDirection={"column"}
                        roomIds={event.rooms}
                        showCaption={false}
                    />
                </Box>
            </Box>

            <Box
                alignContent={"space-between"}
                alignItems={"flex-end"}
                display={"flex"}
                flexDirection={"column"}
                flexGrow={0}
                flexShrink={1}
                flexWrap={"wrap"}
                height={"100%"}
                justifyContent={"space-between"}
                sx={{ direction: "rtl" }}
            >
                <EventDurationLabel
                    event={event}
                    size="smallest"
                    sx={{ direction: "ltr" }}
                />
                <EventStatusIcons
                    event={event}
                    flexDirection={"column"}
                    flexGrow={1}
                    size={"0.7rem"}
                />
            </Box>
        </Box>
    );
}
