/**
 * Name: useCalendarHandlers.ts
 * Purpose: Custom hook to manage calendar event logic and keyboard shortcuts.
 * Created: 2026-04-18
 * Author: Michael K. Steinberg
 */

import dayjs from "dayjs";
import { useCallback, useEffect, useRef, useState } from "react";
import type { SlotInfo } from "react-big-calendar";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";

import { ResolvableRoom } from "@/api-shared/types/room";
import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { Event } from "@/components/schedule/types/event";

const DUMMY_ROOM_ID = "no-room-unassigned";

export function useCalendarHandlers(
    events: Array<Event>,
    handleSaveEvent: (event: Event) => void,
    handleDeleteEvent: (eventId: Event["id"]) => void,
    setSelectedEvent: (event: Partial<Event> | undefined) => void,
    setOpenEventDialog: (open: boolean) => void,
) {
    const { filteredInstructors, filteredCourses } = useCalendarFilters();

    const [activeEvent, setActiveEvent] = useState<Event | null>(null);
    const [copiedEvent, setCopiedEvent] = useState<Event | null>(null);
    const [selectedSlotInfo, setSelectedSlotInfo] = useState<{
        start: Date;
        resourceId?: any;
    } | null>(null);

    const copyPasteData = useRef({ activeEvent, copiedEvent, selectedSlotInfo });

    useEffect(() => {
        copyPasteData.current = { activeEvent, copiedEvent, selectedSlotInfo };
    }, [activeEvent, copiedEvent, selectedSlotInfo]);

    const handleEventDrag = useCallback(
        (changes: EventInteractionArgs<Event>): void => {
            if (changes.event.locked) return;

            const roomId: null | ResolvableRoom = changes.resourceId
                ? JSON.parse(changes.resourceId.toString())
                : null;

            let newRooms = changes.event.rooms;
            if (roomId) {
                if (roomId.id === DUMMY_ROOM_ID) {
                    newRooms = [];
                } else if (changes.event.rooms.length <= 1) {
                    newRooms = [roomId];
                }
            }

            const updatedEvent: Event = {
                ...changes.event,
                startTime: dayjs(changes.start),
                endTime: dayjs(changes.end),
                rooms: newRooms,
            };

            handleSaveEvent(updatedEvent);
        },
        [handleSaveEvent],
    );

    const handleSlotSelect = useCallback(
        (slotInfo: SlotInfo): void => {
            setSelectedSlotInfo({
                start: slotInfo.start,
                resourceId: slotInfo.resourceId,
            });
            setActiveEvent(null);

            if (slotInfo.action === "click") return;

            const roomId: null | ResolvableRoom = slotInfo.resourceId
                ? JSON.parse(slotInfo.resourceId.toString())
                : null;

            const newRooms = roomId && roomId.id !== DUMMY_ROOM_ID ? [roomId] : [];

            const newEvent = {
                startTime: dayjs(slotInfo.start),
                endTime: dayjs(slotInfo.end),
                rooms: newRooms,
                instructors: filteredInstructors,
                courses: filteredCourses,
            };

            setSelectedEvent(newEvent);
            setOpenEventDialog(true);
        },
        [setSelectedEvent, setOpenEventDialog, filteredInstructors, filteredCourses],
    );

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName))
                return;

            const {
                activeEvent: currentActive,
                copiedEvent: currentCopied,
                selectedSlotInfo: currentSlot,
            } = copyPasteData.current;
            const isCmdOrCtrl = e.ctrlKey || e.metaKey;

            if (e.key === "Delete" && currentActive?.id) {
                handleDeleteEvent(currentActive.id);
            }

            if (isCmdOrCtrl && e.key === "c" && currentActive) {
                setCopiedEvent(currentActive);
            }

            if (isCmdOrCtrl && e.key === "v" && currentCopied) {
                e.preventDefault();
                const originalStart = dayjs(currentCopied.startTime);
                const originalEnd = dayjs(currentCopied.endTime);
                const duration = originalEnd.diff(originalStart, "minute");

                let newStart = currentSlot
                    ? dayjs(currentSlot.start)
                    : originalStart.add(30, "minute");
                let newEnd = newStart.add(duration, "minute");

                let newRooms = currentCopied.rooms;
                if (currentSlot?.resourceId) {
                    const parsedRoomId = JSON.parse(currentSlot.resourceId.toString());
                    newRooms = parsedRoomId.id === DUMMY_ROOM_ID ? [] : [parsedRoomId];
                }

                const { id: _, ...rest } = currentCopied as any;
                const newEvent = {
                    ...rest,
                    startTime: newStart, // Keep Dayjs objects to align with the Event type signature
                    endTime: newEnd, // Keep Dayjs objects to align with the Event type signature
                    rooms: newRooms,
                } as Event;

                handleSaveEvent(newEvent);
                setActiveEvent(newEvent);
                setSelectedSlotInfo(null);
            }
        },
        [handleSaveEvent, handleDeleteEvent],
    );

    useEffect(() => {
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    return {
        handleEventDrag,
        handleSlotSelect,
        setActiveEvent,
        activeEvent,
    };
}
