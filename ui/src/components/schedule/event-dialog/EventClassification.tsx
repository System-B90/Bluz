"use client";
import Box from "@mui/material/Box";

import { CourseField } from "@/components/schedule/event-dialog/CourseField";
import { EventTypeField } from "@/components/schedule/event-dialog/EventTypeField";
import { LessonField } from "@/components/schedule/event-dialog/LessonField";
import { ModuleField } from "@/components/schedule/event-dialog/ModuleField";
import { PrayerTypeField } from "@/components/schedule/event-dialog/PrayerType";
import { RoomField } from "@/components/schedule/event-dialog/RoomField";
import { SubjectField } from "@/components/schedule/event-dialog/SubjectField";
import {
    Event,
    EventType,
    PrayerEvent,
} from "@/components/schedule/types/event";

export function EventClassification({
    event,
    onUpdate,
}: {
    event: Partial<Event>;
    onUpdate: (u: Partial<Event>) => void;
})
{
    const isPrayer = event?.type === EventType.PRAYER;
    // Fake events aren't wired to Hive, and a break has no subject of its own
    // — hide subject/module/lesson for both (#102).
    const showHiveFields =
        !isPrayer && !event?.fake && event?.type !== EventType.BREAK;

    return (
        <Box
            alignItems="flex-start"
            display="flex"
            gap={ 2 }
            justifyContent="flex-start"
            width="100%"
        >
            <EventTypeField
                event={ event }
                onBlurCallback={ onUpdate }
                sx={ { width: "15%" } }
            />

            {/* Prayer specific field with transition */ }
            <Box
                sx={ {
                    width: isPrayer ? "25%" : 0,
                    opacity: isPrayer ? 1 : 0,
                    transform: isPrayer ? "scale(1)" : "scale(0.95)",
                    transition:
                        "all 0.3s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    overflow: "hidden",
                    display: "flex",
                    alignItems: "flex-start",
                    visibility: isPrayer ? "visible" : "hidden",
                    mr: isPrayer ? 0 : -2,
                    pt: 1.5,
                    mt: -1.5,
                } }
            >
                <PrayerTypeField
                    event={ event as PrayerEvent }
                    onEventChange={ onUpdate }
                    sx={ { width: "100%" } }
                />
            </Box>

            {/* Subject, Module and Lesson fields with transition */ }
            <Box
                sx={ {
                    width: showHiveFields ? "52%" : 0,
                    opacity: showHiveFields ? 1 : 0,
                    transform: showHiveFields ? "scale(1)" : "scale(0.95)",
                    transition:
                        "all 0.3s cubic-bezier(0.4, 0, 0.2, 1), visibility 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    overflow: "hidden",
                    display: "flex",
                    gap: 2,
                    alignItems: "flex-start",
                    visibility: showHiveFields ? "visible" : "hidden",
                    mr: showHiveFields ? 0 : -2,
                    pt: 1.5,
                    mt: -1.5,
                } }
            >
                <SubjectField
                    event={ event }
                    onEventChange={ onUpdate }
                    sx={ { width: "33%", minWidth: "80px" } }
                />
                <ModuleField
                    event={ event }
                    onEventChange={ onUpdate }
                    sx={ { width: "33%", minWidth: "80px" } }
                />
                <LessonField
                    event={ event }
                    onEventChange={ onUpdate }
                    sx={ { width: "33%", minWidth: "80px" } }
                />
            </Box>

            <Box display="flex" flexGrow={ 1 } gap="inherit">
                <CourseField
                    event={ event }
                    fullWidth
                    key={ `course-${event?.id}-${event?.updatedAt}` }
                    onBlurCallback={ onUpdate }
                />
                <RoomField
                    event={ event }
                    fullWidth
                    key={ `room-${event?.id}-${event?.updatedAt}` }
                    onBlurCallback={ onUpdate }
                />
            </Box>
        </Box>
    );
}
