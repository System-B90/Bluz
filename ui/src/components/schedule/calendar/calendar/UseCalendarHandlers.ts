import dayjs from "dayjs";
import { closeSnackbar, enqueueSnackbar } from "notistack";
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import type { SlotInfo } from "react-big-calendar";
import type { EventInteractionArgs } from "react-big-calendar/lib/addons/dragAndDrop";

import {
    breakWindowsFor,
    collectBreakWindows,
    workingMsOf,
} from "@/api-shared/break-windows";
import { MIN_SEGMENT_MINUTES, workingMsUpTo } from "@/api-shared/interval-layout";
import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { ResolvableRoom, resourceKeyToResolvable } from "@/api-shared/types/room";
import { useCalendarFilters } from "@/components/base/CalendarFilterProvider";
import { Event } from "@/components/schedule/types/event";

const DUMMY_ROOM_ID = "no-room-unassigned";
const MIN_WORKING_MS = MIN_SEGMENT_MINUTES * 60_000;

/**
 * What a committed grid gesture was: a plain move, a resize, or a Ctrl-held
 * move that places a copy and leaves the original where it was (#575).
 */
export type GridInteraction = "duplicate" | "move" | "resize";

/**
 * Everything of an event that a *copy* of it may carry. Strips the id, the
 * gantt-cut provenance (ganttEventId/ganttOccurrenceDate/ganttCurriculumId,
 * see EventFactory.ts's invariant) — carrying those over would make the copy
 * masquerade as the original event — and the Hive linkage (hiveLesson/
 * hiveQueues), which lesson-sync reconciled for the original event only
 * (#653). Everything else, including locked/hidden/fake, is copied as-is.
 */
function copyableFields(event: Event): Omit<
    Event,
    | "ganttCurriculumId"
    | "ganttEventId"
    | "ganttOccurrenceDate"
    | "hiveLesson"
    | "hiveQueues"
    | "id"
> {
    const {
        id: _id,
        ganttEventId: _ganttEventId,
        ganttOccurrenceDate: _ganttOccurrenceDate,
        ganttCurriculumId: _ganttCurriculumId,
        hiveLesson: _hiveLesson,
        hiveQueues: _hiveQueues,
        ...rest
    } = event;
    return rest;
}

/**
 * Custom React hook to manage calendar event logic, user interactions (e.g. drag & drop, select, click),
 * and keyboard shortcuts (copy, paste, delete).
 *
 * @param events - The current list of calendar events.
 * @param handleSaveEvent - Callback when saving an event.
 * @param handleDeleteEvent - Callback when deleting an event.
 * @param setSelectedEvent - State setter to select an event.
 * @param setOpenEventDialog - State setter to open/close the event dialog.
 * @returns State and event handlers for the calendar.
 */
export function useCalendarHandlers(
    events: Array<Event>,
    handleSaveEvent: (
        event: Event,
        initiator?: EventChangeInitiator,
    ) => Event | undefined | void,
    handleDeleteEvent: (
        eventId: Event["id"],
        initiator?: EventChangeInitiator,
    ) => void,
    setSelectedEvent: (event: Partial<Event> | undefined) => void,
    setOpenEventDialog: (open: boolean) => void,
) {
    const { filteredInstructors, filteredCourses } = useCalendarFilters();

    const [activeEvent, setActiveEvent] = useState<Event | null>(null);
    const [copiedEvent, setCopiedEvent] = useState<Event | null>(null);
    const [selectedSlotInfo, setSelectedSlotInfo] = useState<{
        start: Date;
        resourceId?: SlotInfo["resourceId"];
    } | null>(null);

    const copyPasteData = useRef({
        activeEvent,
        copiedEvent,
        selectedSlotInfo,
    });

    useEffect(() => {
        copyPasteData.current = { activeEvent, copiedEvent, selectedSlotInfo };
    }, [activeEvent, copiedEvent, selectedSlotInfo]);

    const handleEventDrag = useCallback(
        (
            changes: EventInteractionArgs<Event>,
            interaction: GridInteraction = "move",
        ): void => {
            if (changes.event.locked) return;

            const roomId: null | ResolvableRoom = changes.resourceId
                ? resourceKeyToResolvable(changes.resourceId.toString())
                : null;

            let newRooms = changes.event.rooms;
            if (roomId) {
                const alreadyInRoom = changes.event.rooms.some(
                    (room) =>
                        room.id === roomId.id && room.source === roomId.source,
                );
                if (roomId.id === DUMMY_ROOM_ID) {
                    newRooms = [];
                } else if (changes.event.rooms.length <= 1) {
                    newRooms = [roomId];
                } else if (!alreadyInRoom) {
                    // The drop doesn't say which of the event's rooms was
                    // dragged, so there is no safe room to replace. Keep the
                    // time change, but say so instead of silently ignoring
                    // the target column, and let the user jump straight to
                    // the edit dialog to change rooms there (#653).
                    enqueueSnackbar(
                        createElement(
                            "span",
                            null,
                            "לאירוע כמה חדרים — שינוי החדרים נעשה ",
                            createElement(
                                "span",
                                {
                                    style: {
                                        textDecoration: "underline",
                                        fontWeight: 700,
                                        cursor: "pointer",
                                    },
                                    onClick: () => {
                                        setSelectedEvent(changes.event);
                                        setOpenEventDialog(true);
                                        closeSnackbar();
                                    },
                                },
                                "בחלון העריכה",
                            ),
                            ".",
                        ),
                        { variant: "info" },
                    );
                }
            }

            // Ctrl+Drag duplicates: the dragged instance is placed at the
            // drop target as a brand-new event, and the original is left
            // untouched at its original slot. The modifier is resolved by
            // the calendar view, which tracks it live for the whole drag.
            if (interaction === "duplicate") {
                const duplicatedEvent = {
                    ...copyableFields(changes.event),
                    startTime: dayjs(changes.start),
                    endTime: dayjs(changes.end),
                    rooms: newRooms,
                } as Event;

                handleSaveEvent(duplicatedEvent, EventChangeInitiator.DragDrop);
                return;
            }

            const updatedEvent: Event = {
                ...changes.event,
                startTime: dayjs(changes.start),
                endTime: dayjs(changes.end),
                rooms: newRooms,
            };

            handleSaveEvent(
                updatedEvent,
                interaction === "resize"
                    ? EventChangeInitiator.Resize
                    : EventChangeInitiator.DragDrop,
            );
        },
        [handleSaveEvent, setOpenEventDialog, setSelectedEvent],
    );

    /**
     * Cuts an event in two at a wall-clock instant (#657): the original keeps
     * its head and is trimmed to end at the cut, and a new event carrying the
     * same fields takes the tail. Durations are measured in *working* time, so
     * an event that jumps over a break keeps the same total after the cut.
     */
    const handleSplitEvent = useCallback(
        (event: Event, atMs: number): void => {
            if (event.locked) return;

            const windows = breakWindowsFor(event, collectBreakWindows(events));
            const startMs = event.startTime.valueOf();
            const headWorkingMs = workingMsUpTo(startMs, atMs, windows);
            const tailWorkingMs = workingMsOf(event) - headWorkingMs;

            if (headWorkingMs < MIN_WORKING_MS || tailWorkingMs < MIN_WORKING_MS) {
                enqueueSnackbar(
                    `לא ניתן לפצל כאן: כל חלק חייב להימשך לפחות ${MIN_SEGMENT_MINUTES} דקות.`,
                    { variant: "warning" },
                );
                return;
            }

            const head: Event = {
                ...event,
                endTime: dayjs(startMs + headWorkingMs),
            };
            const tail = {
                ...copyableFields(event),
                startTime: dayjs(atMs),
                endTime: dayjs(atMs + tailWorkingMs),
            } as Event;

            handleSaveEvent(head, EventChangeInitiator.Split);
            handleSaveEvent(tail, EventChangeInitiator.Split);
        },
        [events, handleSaveEvent],
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
                ? resourceKeyToResolvable(slotInfo.resourceId.toString())
                : null;

            const newRooms =
                roomId && roomId.id !== DUMMY_ROOM_ID ? [roomId] : [];

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
        [
            setSelectedEvent,
            setOpenEventDialog,
            filteredInstructors,
            filteredCourses,
        ],
    );

    const handleKeyDown = useCallback(
        (e: KeyboardEvent) => {
            // These shortcuts act on the calendar, so they must stay out of the
            // way of anything the user is actually typing into — including
            // rich-text hosts and MUI's Autocomplete/Select listboxes — and out
            // of any open dialog, where Delete and Ctrl+V belong to the form on
            // screen rather than to the events behind it.
            const target = e.target as HTMLElement | null;
            if (
                !target ||
                ["INPUT", "TEXTAREA"].includes(target.tagName) ||
                target.isContentEditable ||
                target.closest(
                    '[contenteditable="true"], [role="combobox"], [role="listbox"], [role="textbox"], .MuiInputBase-root',
                ) !== null ||
                document.querySelector('.MuiDialog-root, [role="dialog"]') !==
                    null
            )
                return;

            const {
                activeEvent: currentActive,
                copiedEvent: currentCopied,
                selectedSlotInfo: currentSlot,
            } = copyPasteData.current;
            const isCmdOrCtrl = e.ctrlKey || e.metaKey;

            if (e.key === "Delete" && currentActive?.id) {
                handleDeleteEvent(
                    currentActive.id,
                    EventChangeInitiator.Keyboard,
                );
            }

            if (isCmdOrCtrl && e.key === "c" && currentActive) {
                setCopiedEvent(currentActive);
            }

            if (isCmdOrCtrl && e.key === "x" && currentActive) {
                setCopiedEvent(currentActive);
                handleDeleteEvent(
                    currentActive.id,
                    EventChangeInitiator.CopyPaste,
                );
                setActiveEvent(null);
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
                    const parsedRoomId = resourceKeyToResolvable(
                        currentSlot.resourceId.toString(),
                    );
                    newRooms =
                        parsedRoomId.id === DUMMY_ROOM_ID ? [] : [parsedRoomId];
                }

                const newEvent = {
                    ...copyableFields(currentCopied),
                    startTime: newStart, // Keep Dayjs objects to align with the Event type signature
                    endTime: newEnd, // Keep Dayjs objects to align with the Event type signature
                    rooms: newRooms,
                } as Event;

                // The saved copy carries the id the provider assigned, so
                // Delete/Ctrl+C/Ctrl+X work on it straight away (#653).
                const saved = handleSaveEvent(
                    newEvent,
                    EventChangeInitiator.CopyPaste,
                );
                setActiveEvent(saved ?? null);
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
        handleSplitEvent,
        handleSlotSelect,
        setActiveEvent,
        activeEvent,
    };
}
