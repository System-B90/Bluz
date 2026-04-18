import { Box, Typography } from "@mui/material";
import { EventProps } from "react-big-calendar";

import { ContainerSize } from "@/components/schedule/event-component/base";
import { EventDurationLabel } from "@/components/schedule/event-component/EventDurationLabel";
import { EventStatusIcons } from "@/components/schedule/event-component/EventStatusIcons";
import { EventTypeIcon } from "@/components/schedule/event-component/EventTypeIcon";
import { CourseComponent } from "@/components/schedule/event-component/parts/course";
import { InstructorsList } from "@/components/schedule/event-component/parts/person";
import { RoomComponent } from "@/components/schedule/event-component/parts/room";
import {
  ModuleComponent,
  SubjectComponent,
} from "@/components/schedule/event-component/parts/subject";
import { Event } from "@/components/schedule/types/event";

export function ShortEventComponent({
  event: event,
  containerSize: _containerSize,
}: { containerSize: ContainerSize } & EventProps<Event>) {
  return (
    <Box
      alignItems={"flex-start"}
      display={"flex"}
      height={"100%"}
      justifyContent={"space-around"}
      padding={0.3}
    >
      <Box
        alignItems={"flex-start"}
        display={"flex"}
        flexDirection={"column"}
        flexGrow={1}
        gap={0.3}
        height={"100%"}
        justifyContent={"space-around"}
      >
        <Box
          alignItems={"center"}
          display={"flex"}
          flexDirection={"row"}
          gap={0}
          marginTop={0}
          paddingTop={0}
          sx={{ marginTop: "0 !important" }}
        >
          <Box alignItems={"baseline"} display={"flex"} flexGrow={1}>
            <EventTypeIcon event={event} fontSize="inherit" />
            <Typography
              noWrap
              sx={{ ml: 0.5, fontWeight: "bold" }}
              variant="subtitle2"
            >
              {event.name}
            </Typography>
          </Box>
          <Box sx={{ width: "0.3rem" }} />
          <Box
            alignItems={"baseline"}
            display={"flex"}
            flexDirection={"row"}
            hidden={event.type === "break"}
            textOverflow={"ellipsis"}
          >
            <SubjectComponent
              fontSize={"0.8rem"}
              fontWeight={500}
              subjectId={event.subject}
            />
            <Box sx={{ width: "0.2rem" }} />
            {event.hiveModule ? (
              <>
                <Typography fontSize={"0.8rem"} fontWeight={400}>
                  /
                </Typography>
                <Box sx={{ width: "0.2rem" }} />
                <ModuleComponent
                  fontSize={"0.8rem"}
                  fontWeight={400}
                  moduleId={event.hiveModule}
                />
              </>
            ) : undefined}
          </Box>
        </Box>
        <Box
          display={"flex"}
          flexDirection={"column"}
          flexWrap={"wrap"}
          gap={0.2}
          height={"100%"}
          justifyContent={"flex-start"}
          overflow={"hidden"}
        >
          <InstructorsList
            chipSize="smaller"
            event={event}
            showCaption={false}
          />
          <CourseComponent
            chipSize="smaller"
            courseIds={event.courses}
            showCaption={false}
          />
          <RoomComponent
            chipSize="smaller"
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
        gap={0.2}
        height={"100%"}
        justifyContent={"space-between"}
        position={"relative"}
      >
        <EventDurationLabel event={event} size="smaller" />
        <EventStatusIcons
          event={event}
          flexDirection={"column"}
          flexGrow={1}
          justifyContent={"flex-end"}
          size={"1rem"}
        />
      </Box>
    </Box>
  );
}
