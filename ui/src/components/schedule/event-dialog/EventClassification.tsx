"use client";

import { Box } from "@mui/material";

import { CourseField } from "@/components/schedule/event-dialog/CourseField";
import { EventTypeField } from "@/components/schedule/event-dialog/EventTypeField";
import { ModuleField } from "@/components/schedule/event-dialog/ModuleField";
import { PrayerTypeField } from "@/components/schedule/event-dialog/PrayerType";
import { RoomField } from "@/components/schedule/event-dialog/RoomField";
import { SubjectField } from "@/components/schedule/event-dialog/SubjectField";
import { Event, PrayerEvent } from "@/components/schedule/types/event";

export function EventClassification({
    event,
    onUpdate,
}: {
  event: Event;
  onUpdate: (u: Partial<Event>) => void;
}) {
    return (
        <Box display="flex" gap={2} justifyContent="flex-start" width="100%">
            <EventTypeField
                event={event}
                onBlurCallback={onUpdate}
                sx={{ width: "12.5%" }}
            />

            {event?.type === "prayer" ? (
                <PrayerTypeField
                    event={event as PrayerEvent}
                    onEventChange={onUpdate}
                    sx={{ width: "25%" }}
                />
            ) : (
                <>
                    <SubjectField
                        event={event}
                        onEventChange={onUpdate}
                        sx={{ width: "18%" }}
                    />
                    <ModuleField
                        event={event}
                        onEventChange={onUpdate}
                        sx={{ width: "17%" }}
                    />
                </>
            )}

            <Box display="flex" flexGrow={1} gap="inherit">
                <CourseField event={event} fullWidth onBlurCallback={onUpdate} />
                <RoomField event={event} fullWidth onBlurCallback={onUpdate} />
            </Box>
        </Box>
    );
}
