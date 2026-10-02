"use client";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ContentCutIcon from "@mui/icons-material/ContentCut";
import ContentPasteIcon from "@mui/icons-material/ContentPaste";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import LabelOutlinedIcon from "@mui/icons-material/LabelOutlined";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import TimelineIcon from "@mui/icons-material/Timeline";
import UpdateIcon from "@mui/icons-material/Update";
import Box from "@mui/material/Box";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import { useRouter } from "next/navigation";
import { enqueueSnackbar } from "notistack";
import { useCallback, useEffect, useMemo, useRef } from "react";

import { CourseId } from "@/api-shared/types/course";
import { EventChangeInitiator } from "@/api-shared/types/event-history";
import {
    resourceKeyToResolvable,
    Room,
    roomLikeToResourceKey,
} from "@/api-shared/types/room";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { PasteSlot } from "@/components/schedule/calendar/calendar/paste";
import { useCalendar } from "@/components/schedule/calendar/calendar-provider/CalendarContext";
import {
    duplicateOf,
    postponedByAWeek,
    reassignedToRoom,
    triStateOf,
    withCourseMembership,
    withInstructorMembership,
} from "@/components/schedule/event-context-menu/actions";
import { CourseSubmenu } from "@/components/schedule/event-context-menu/CourseSubmenu";
import {
    PickerOption,
    PickerSubmenu,
    Submenu,
} from "@/components/schedule/event-context-menu/Submenu";
import { ContextMenuTarget } from "@/components/schedule/event-context-menu/use-event-context-menu";
import { buildGanttEventLink } from "@/components/schedule/event-dialog/utils";
import {
    EVENT_FLAGS,
    EventFlagKey,
    eventFlagUpdate,
} from "@/components/schedule/event-flags";
import { Event, EventId } from "@/components/schedule/types/event";

/** Clipboard (#859): the same actions as Ctrl+C / Ctrl+X / Ctrl+V. */
export type ContextMenuClipboard = {
    copy: (event: Event) => void;
    cut: (event: Event) => void;
    /** Pastes at the clicked event's start time. */
    paste: (slot: PasteSlot) => void;
    canPaste: boolean;
};

/** What stands between a menu entry and a write. */
export type ContextMenuGuards = {
    /** Guards the bulk deletes; resolves false when the user backs out. */
    confirm: (message: string, options?: { title?: string }) => Promise<boolean>;
    /**
     * Asks before editing events another user has open (#775); resolves true
     * at once when none of them is locked.
     */
    confirmLockedEdit: (eventIds: Array<EventId>) => Promise<boolean>;
    /**
     * A past iteration: the server rejects its writes, so only Copy (to paste
     * into a writable iteration) and navigation stay enabled.
     */
    readOnly: boolean;
};

export type EventContextMenuProps = {
    target: ContextMenuTarget | null;
    onClose: () => void;
    /** The live event list — the target ids are resolved against it. */
    events: Array<Event>;
    rooms: Array<Room>;
    onSaveEvent: (
        event: Event,
        initiator?: EventChangeInitiator,
    ) => Event | undefined | void;
    onDeleteEvent: (
        eventId: EventId,
        initiator?: EventChangeInitiator,
    ) => void;
    clipboard: ContextMenuClipboard;
    guards: ContextMenuGuards;
};

/**
 * Right-click menu for calendar tiles (#706). Every entry acts on *all* the
 * targeted events, so the single-event and multi-select cases are one code
 * path — a selection of one is simply the common case.
 */
export function EventContextMenu({
    target,
    onClose,
    events,
    rooms,
    onSaveEvent,
    onDeleteEvent,
    clipboard: { copy: onCopy, cut: onCut, paste: onPaste, canPaste },
    guards: { confirm: onConfirm, confirmLockedEdit: onConfirmLockedEdit, readOnly },
}: EventContextMenuProps) {
    const router = useRouter();
    const { iterationId } = useCalendar();
    const { instructors } = useHiveUsers();

    // Resolved fresh on every render so a marker toggled with the menu still
    // open immediately shows its new state, and an event deleted underneath us
    // (by a bulk action or another user) simply drops out of the target.
    const targets = useMemo(() => {
        if (!target) return [];
        const wanted = new Set(target.eventIds);
        return events.filter((event) => wanted.has(event.id));
    }, [target, events]);

    const isBulk = targets.length > 1;

    // One "edit anyway" covers the whole menu session: submenu toggles are
    // often flipped two or three in a row and must not ask each time.
    const lockAckFor = useRef<ContextMenuTarget | null>(null);
    const ensureLockAck = useCallback(async (): Promise<boolean> => {
        if (lockAckFor.current === target) return true;
        const ok = await onConfirmLockedEdit(targets.map((event) => event.id));
        if (ok) lockAckFor.current = target;
        return ok;
    }, [target, targets, onConfirmLockedEdit]);

    /**
     * Writes a change for every target, skipping the ones the transform leaves
     * untouched so an already-correct event is not pushed to the server (and
     * does not toast) for nothing.
     */
    const applyToTargets = useCallback(
        (transform: (event: Event) => Event | null) => {
            void ensureLockAck().then((ok) => {
                if (!ok) return;
                for (const event of targets) {
                    const updated = transform(event);
                    if (updated && updated !== event) {
                        onSaveEvent(updated, EventChangeInitiator.ContextMenu);
                    }
                }
            });
        },
        [targets, onSaveEvent, ensureLockAck],
    );

    /** Runs an action and dismisses the menu — the shape most entries want. */
    const runAndClose = useCallback(
        (action: () => void) => {
            action();
            onClose();
        },
        [onClose],
    );

    /* ── Timing ─────────────────────────────────────────────── */

    const postpone = useCallback(async () => {
        if (!(await ensureLockAck())) return;
        // A locked ("מתואם") event refuses timing changes everywhere else —
        // drag, resize and split all bail on it — so postponing must not be
        // the one back door that moves it anyway.
        const movable = targets.filter((event) => !event.locked);
        const blocked = targets.length - movable.length;

        for (const event of movable) {
            onSaveEvent(postponedByAWeek(event), EventChangeInitiator.ContextMenu);
        }

        if (blocked > 0) {
            enqueueSnackbar(
                blocked === targets.length
                    ? "מופע מתואם לא ניתן לדחייה."
                    : `${blocked} מופעים מתואמים לא נדחו.`,
                { variant: "warning" },
            );
        }
    }, [targets, onSaveEvent, ensureLockAck]);

    const duplicate = useCallback(() => {
        for (const event of targets) {
            onSaveEvent(duplicateOf(event), EventChangeInitiator.ContextMenu);
        }
    }, [targets, onSaveEvent]);

    /* ── Delete ─────────────────────────────────────────────── */

    const remove = useCallback(async () => {
        if (!(await ensureLockAck())) return;
        // A one-off delete matches the Delete key and is undoable, so it asks
        // nothing. Wiping a whole selection in one click is the case worth a
        // second look.
        if (
            isBulk &&
            !(await onConfirm(`למחוק ${targets.length} מופעים?`, {
                title: "מחיקת מופעים",
            }))
        ) {
            return;
        }
        for (const event of targets) {
            onDeleteEvent(event.id, EventChangeInitiator.ContextMenu);
        }
    }, [isBulk, targets, onConfirm, onDeleteEvent, ensureLockAck]);

    /* ── Clipboard (#859) ───────────────────────────────────── */

    // The clipboard holds one event, matching Ctrl+C, so copy/cut are offered
    // for a single target only.
    const single = targets.length === 1 ? targets[0] : null;

    const cut = useCallback(async () => {
        if (!single || !(await ensureLockAck())) return;
        onCut(single);
    }, [single, ensureLockAck, onCut]);

    /* ── Reassignment ───────────────────────────────────────── */

    const roomOptions = useMemo<Array<PickerOption>>(
        () =>
            rooms.map((room) => ({
                id: roomLikeToResourceKey(room),
                label: room.name,
            })),
        [rooms],
    );

    const pickRoom = useCallback(
        (resourceKey: null | string) => {
            const room = resourceKey ? resourceKeyToResolvable(resourceKey) : null;
            applyToTargets((event) => reassignedToRoom(event, room));
        },
        [applyToTargets],
    );

    const toggleInstructor = useCallback(
        (instructorId: number) => {
            const next =
                triStateOf(targets, (event) =>
                    event.instructors.includes(instructorId),
                ) !== "all";
            applyToTargets((event) =>
                withInstructorMembership(event, instructorId, next),
            );
        },
        [targets, applyToTargets],
    );

    /* ── Markers & shuffles ─────────────────────────────────── */

    const toggleFlag = useCallback(
        (key: EventFlagKey) => {
            // Over a mixed selection one click turns the marker *on* for
            // everyone, rather than inverting each event separately — which
            // would leave the selection just as mixed as it started.
            const next = triStateOf(targets, (event) => !!event[key]) !== "all";
            applyToTargets((event) =>
                !!event[key] === next ? null : { ...event, ...eventFlagUpdate(key, next) },
            );
        },
        [targets, applyToTargets],
    );

    const toggleCourse = useCallback(
        (courseId: CourseId) => {
            const next =
                triStateOf(targets, (event) => event.courses.includes(courseId)) !==
                "all";
            applyToTargets((event) =>
                withCourseMembership(event, courseId, next),
            );
        },
        [targets, applyToTargets],
    );

    /* ── Gantt ──────────────────────────────────────────────── */

    // A jump only makes sense with a single destination, so it is offered for
    // one target at a time and only when that event was actually cut from a
    // gantt that can still be resolved.
    const ganttLink =
        targets.length === 1
            ? buildGanttEventLink(targets[0], iterationId)
            : undefined;

    // Every targeted event disappeared while the menu was open (a bulk delete
    // of its own targets, or another user's edit) — there is nothing left to
    // act on, so the menu dismisses itself.
    useEffect(() => {
        if (target && targets.length === 0) onClose();
    }, [target, targets.length, onClose]);

    if (!target || targets.length === 0) return null;

    return (
        <Menu
            anchorPosition={target.position}
            anchorReference="anchorPosition"
            onClose={onClose}
            open
            slotProps={{ paper: { sx: { minWidth: 240 } } }}
        >
            {isBulk ? (
                <Box sx={{ px: 2, pt: 0.5, pb: 1 }}>
                    <Typography color="text.secondary" variant="caption">
                        { `${targets.length} מופעים נבחרו` }
                    </Typography>
                </Box>
            ) : null}

            <MenuItem disabled={readOnly || !single} onClick={() => runAndClose(() => void cut())}>
                <ListItemIcon>
                    <ContentCutIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>גזירה</ListItemText>
                <Typography color="text.secondary" sx={{ marginInlineStart: 2 }} variant="body2">
                    Ctrl+X
                </Typography>
            </MenuItem>
            <MenuItem
                disabled={!single}
                onClick={() => runAndClose(() => single && onCopy(single))}
            >
                <ListItemIcon>
                    <ContentCopyIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>העתקה</ListItemText>
                <Typography color="text.secondary" sx={{ marginInlineStart: 2 }} variant="body2">
                    Ctrl+C
                </Typography>
            </MenuItem>
            <MenuItem
                disabled={readOnly || !canPaste || !single}
                onClick={() =>
                    runAndClose(() =>
                        single && onPaste({ start: single.startTime.toDate() }),
                    )
                }
            >
                <ListItemIcon>
                    <ContentPasteIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>הדבקה</ListItemText>
                <Typography color="text.secondary" sx={{ marginInlineStart: 2 }} variant="body2">
                    Ctrl+V
                </Typography>
            </MenuItem>

            <Divider />

            <MenuItem disabled={readOnly} onClick={() => runAndClose(duplicate)}>
                <ListItemIcon>
                    <ContentCopyIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>{isBulk ? "שכפול הנבחרים" : "שכפול"}</ListItemText>
            </MenuItem>

            <MenuItem disabled={readOnly} onClick={() => runAndClose(() => void postpone())}>
                <ListItemIcon>
                    <UpdateIcon fontSize="small" />
                </ListItemIcon>
                <ListItemText>דחייה בשבוע</ListItemText>
            </MenuItem>

            <Divider />

            <PickerSubmenu
                clearLabel="ללא כיתה"
                disabled={readOnly}
                emptyLabel="אין כיתות"
                icon={<MeetingRoomIcon fontSize="small" />}
                label="שיוך כיתה"
                onPick={(id) => runAndClose(() => pickRoom(id))}
                options={roomOptions}
            />

            {/* Marker, shuffle and instructor submenus stay open on click:
                these are the entries a user flips two or three of in a row. */}
            <Submenu
                disabled={readOnly}
                icon={<PersonOutlineIcon fontSize="small" />}
                label="שיוך מבזר"
            >
                {instructors.length === 0 ? (
                    <Typography
                        sx={{ px: 2, py: 1, color: "text.secondary" }}
                        variant="body2"
                    >
                        אין מבזרים
                    </Typography>
                ) : (
                    instructors.map((instructor) => {
                        const state = triStateOf(targets, (event) =>
                            event.instructors.includes(instructor.id),
                        );
                        return (
                            <MenuItem
                                key={instructor.id}
                                onClick={() => toggleInstructor(instructor.id)}
                            >
                                <ListItemIcon>
                                    <Checkbox
                                        checked={state === "all"}
                                        disableRipple
                                        indeterminate={state === "some"}
                                        size="small"
                                        sx={{ p: 0 }}
                                    />
                                </ListItemIcon>
                                <ListItemText>{instructor.display_name}</ListItemText>
                            </MenuItem>
                        );
                    })
                )}
            </Submenu>

            <CourseSubmenu
                disabled={readOnly}
                onToggle={toggleCourse}
                stateOf={(courseId) =>
                    triStateOf(targets, (event) =>
                        event.courses.includes(courseId),
                    )
                }
            />

            <Submenu disabled={readOnly} icon={<LabelOutlinedIcon fontSize="small" />} label="סימון כ…">
                {EVENT_FLAGS.map(({ key, label, hue, Icon }) => {
                    const state = triStateOf(targets, (event) => !!event[key]);
                    return (
                        <MenuItem key={key} onClick={() => toggleFlag(key)}>
                            <ListItemIcon>
                                <Checkbox
                                    checked={state === "all"}
                                    disableRipple
                                    indeterminate={state === "some"}
                                    size="small"
                                    sx={{ p: 0 }}
                                />
                            </ListItemIcon>
                            <Icon
                                fontSize="small"
                                sx={{ color: hue, marginInlineEnd: 1, fontSize: 18 }}
                            />
                            <ListItemText>{label}</ListItemText>
                        </MenuItem>
                    );
                })}
            </Submenu>

            {ganttLink ? <Divider /> : null}
            {ganttLink ? (
                <MenuItem
                    onClick={() => runAndClose(() => router.push(ganttLink))}
                >
                    <ListItemIcon>
                        <TimelineIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>מעבר למופע בגאנט</ListItemText>
                </MenuItem>
            ) : null}

            <Divider />

            <MenuItem
                disabled={readOnly}
                onClick={() => {
                    // Closed first so the confirmation is not raised behind
                    // the menu it was invoked from.
                    onClose();
                    void remove();
                }}
                sx={{ color: "error.main" }}
            >
                <ListItemIcon>
                    <DeleteOutlineIcon color="error" fontSize="small" />
                </ListItemIcon>
                <ListItemText>{isBulk ? "מחיקת הנבחרים" : "מחיקה"}</ListItemText>
            </MenuItem>
        </Menu>
    );
}
