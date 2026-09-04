"use client";
import {
    DndContext,
    DragEndEvent,
    DragOverlay,
    DragStartEvent,
    MeasuringStrategy,
    PointerSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import Box from "@mui/material/Box";
import { enqueueSnackbar } from "notistack";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

import { EventChangeInitiator } from "@/api-shared/types/event-history";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { HiveAvatar } from "@/components/header/HiveAvatarImage";
import {
    findPersonConflicts,
    planPersonMove,
    targetFieldFor,
    withPersonAdded,
    withPersonRemoved,
} from "@/components/schedule/calendar/instructor-dnd/assign";
import {
    asInstructorDragData,
    EventDropData,
    InstructorDragData,
    PersonField,
    UNASSIGN_DROPPABLE_ID,
} from "@/components/schedule/calendar/instructor-dnd/types";
import { Event, PersonId } from "@/components/schedule/types/event";

type InstructorDndContextState = {
    /** The drag in flight, or `null` when nothing is being dragged. */
    activeDrag: InstructorDragData | null;
    /** Live Shift state during the drag — flips the drop target field. */
    modifierHeld: boolean;
};

const InstructorDndStateContext = createContext<InstructorDndContextState>({
    activeDrag: null,
    modifierHeld: false,
});

export function useInstructorDnd(): InstructorDndContextState {
    return useContext(InstructorDndStateContext);
}

function personLabel(
    personId: PersonId,
    getName: (id: number) => string | undefined,
): string {
    return typeof personId === "number"
        ? (getName(personId) ?? String(personId))
        : String(personId);
}

type InstructorDndProviderProps = {
    events: Array<Event>;
    handleSaveEvent: (event: Event, initiator?: EventChangeInitiator) => void;
    children: React.ReactNode;
};

/**
 * Layers a @dnd-kit drag context over the calendar so instructors can be
 * assigned by dropping them onto an event and unassigned by dragging their chip
 * out of it. react-big-calendar's own DnD addon keeps owning event *movement*:
 * the two never collide because every dnd-kit drag source stops pointer
 * propagation, and drop targets only register refs.
 *
 * @param props Events in state plus the shared save callback.
 * @returns The provider element wrapping the calendar subtree.
 */
export function InstructorDndProvider({
    events,
    handleSaveEvent,
    children,
}: InstructorDndProviderProps) {
    const { getInstructor } = useHiveUsers();
    const [activeDrag, setActiveDrag] = useState<InstructorDragData | null>(
        null,
    );
    const [modifierHeld, setModifierHeld] = useState(false);

    // Matches the Gantt's threshold (#88) so a click on a chip stays a click.
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    );

    const getName = useCallback(
        (id: number) => getInstructor(id)?.display_name,
        [getInstructor],
    );

    // dnd-kit's drop event carries only the activator's modifier state, so the
    // live Shift value is tracked for as long as a drag is in flight.
    useEffect(() => {
        if (!activeDrag) return;
        const sync = (e: KeyboardEvent) => setModifierHeld(e.shiftKey);
        window.addEventListener("keydown", sync);
        window.addEventListener("keyup", sync);
        return () => {
            window.removeEventListener("keydown", sync);
            window.removeEventListener("keyup", sync);
        };
    }, [activeDrag]);

    const handleDragStart = useCallback((dragEvent: DragStartEvent) => {
        const data = asInstructorDragData(dragEvent.active.data.current);
        if (!data) return;
        setActiveDrag(data);
        setModifierHeld(
            Boolean((dragEvent.activatorEvent as PointerEvent).shiftKey),
        );
    }, []);

    const assignToEvent = useCallback(
        (
            target: Event,
            personId: PersonId,
            withModifier: boolean,
            sourceField?: PersonField,
        ): boolean => {
            const field = targetFieldFor(target, withModifier, sourceField);
            // Only `lecturers` can hold an outsider. Dropping one where it
            // cannot be written used to look like "already assigned" and, on a
            // move, left the person removed from the source and added nowhere
            // (#625).
            if (field === "instructors" && typeof personId !== "number") {
                enqueueSnackbar(
                    `${personLabel(personId, getName)} יכול לשמש כמרצה בלבד, ואירוע מסוג ${target.type} אינו נושא מרצים.`,
                    { variant: "warning" },
                );
                return false;
            }

            const updated = withPersonAdded(target, personId, field);
            if (!updated) {
                enqueueSnackbar(
                    `${personLabel(personId, getName)} כבר משובץ לאירוע זה.`,
                    { variant: "info" },
                );
                return false;
            }

            const conflicts = findPersonConflicts(events, personId, target);
            handleSaveEvent(updated, EventChangeInitiator.InstructorAssign);

            if (conflicts.length > 0) {
                enqueueSnackbar(
                    `${personLabel(personId, getName)} משובץ במקביל ל-${conflicts.length} אירועים אחרים: ${conflicts
                        .map((conflict) => conflict.name)
                        .join(", ")}`,
                    { variant: "warning" },
                );
            }

            return true;
        },
        [events, getName, handleSaveEvent],
    );

    const unassignFromEvent = useCallback(
        (eventId: Event["id"], personId: PersonId) => {
            const source = events.find((candidate) => candidate.id === eventId);
            if (!source || source.locked) return;

            const updated = withPersonRemoved(source, personId);
            if (updated) {
                handleSaveEvent(updated, EventChangeInitiator.InstructorAssign);
            }
        },
        [events, handleSaveEvent],
    );

    const handleDragEnd = useCallback(
        (dragEvent: DragEndEvent) => {
            const data = asInstructorDragData(dragEvent.active.data.current);
            const withModifier = modifierHeld;
            setActiveDrag(null);
            setModifierHeld(false);

            const over = dragEvent.over;
            if (!data || !over) return;

            if (over.id === UNASSIGN_DROPPABLE_ID) {
                if (data.kind === "event-person") {
                    unassignFromEvent(data.eventId, data.personId);
                }
                return;
            }

            const dropData = over.data.current as EventDropData | undefined;
            if (dropData?.kind !== "event") return;

            const target = dropData.event;
            if (target.locked) {
                enqueueSnackbar("האירוע נעול.", { variant: "warning" });
                return;
            }

            if (data.kind !== "event-person") {
                assignToEvent(target, data.personId, withModifier);
                return;
            }

            // Chip dragged from one event onto another: move, don't copy.
            if (data.eventId === target.id) return;

            // Both halves of the move have to be possible before either runs:
            // a locked source would otherwise keep the person while the target
            // gained them (#626), and a target that cannot hold them would
            // leave them removed from the source and added nowhere (#625).
            const source = events.find(
                (candidate) => candidate.id === data.eventId,
            );
            const plan = planPersonMove(
                source,
                target,
                data.personId,
                withModifier,
                data.field,
            );
            if (!plan.allowed) {
                enqueueSnackbar(
                    plan.reason === "locked-source"
                        ? "אירוע המקור נעול."
                        : `${personLabel(data.personId, getName)} יכול לשמש כמרצה בלבד, ואירוע מסוג ${target.type} אינו נושא מרצים.`,
                    { variant: "warning" },
                );
                return;
            }

            if (assignToEvent(target, data.personId, withModifier, data.field))
            {
                unassignFromEvent(data.eventId, data.personId);
            }
        },
        [assignToEvent, events, getName, modifierHeld, unassignFromEvent],
    );

    const handleDragCancel = useCallback(() => {
        setActiveDrag(null);
        setModifierHeld(false);
    }, []);

    const state = useMemo(
        () => ({ activeDrag, modifierHeld }),
        [activeDrag, modifierHeld],
    );

    return (
        <DndContext
            measuring={{
                droppable: { strategy: MeasuringStrategy.WhileDragging },
            }}
            onDragCancel={handleDragCancel}
            onDragEnd={handleDragEnd}
            onDragStart={handleDragStart}
            sensors={sensors}
        >
            <InstructorDndStateContext.Provider value={state}>
                {children}
                <DragOverlay dropAnimation={null}>
                    {activeDrag ? (
                        <Box
                            sx={{
                                px: 0.75,
                                py: 0.35,
                                borderRadius: 1,
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                bgcolor: "primary.main",
                                color: "primary.contrastText",
                                boxShadow: 4,
                                pointerEvents: "none",
                                display: "flex",
                                alignItems: "center",
                                gap: 0.75,
                            }}
                        >
                            {typeof activeDrag.personId === "number" ? (
                                <HiveAvatar
                                    alt={personLabel(
                                        activeDrag.personId,
                                        getName,
                                    )}
                                    hiveId={activeDrag.personId}
                                    sx={{
                                        width: 22,
                                        height: 22,
                                        fontSize: "0.7rem",
                                    }}
                                />
                            ) : null}
                            {personLabel(activeDrag.personId, getName)}
                        </Box>
                    ) : null}
                </DragOverlay>
            </InstructorDndStateContext.Provider>
        </DndContext>
    );
}
