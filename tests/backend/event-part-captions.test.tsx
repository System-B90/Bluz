// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import dayjs from "dayjs";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The icon caption beside an event's people and rooms says how many there
 * are. It has to count what is on screen: both lists drop entries that fail
 * to resolve, so counting the raw ids labelled a single chip as plural.
 */

vi.mock("@/components/base/CalendarFilterProvider", () => ({
    isInstructorBusy: () => false,
    useCalendarFilters: () => ({
        filteredInstructors: [],
        setFilteredInstructors: vi.fn(),
        showMisconfigurations: true,
    }),
}));
vi.mock("@/components/base/HiveUsersProvider", () => ({
    useHiveUsers: () => ({
        getInstructor: (id: number) =>
            id === 7 ? { display_name: "מיכאל" } : undefined,
        instructors: [{ display_name: "מיכאל" }],
    }),
}));
vi.mock("@/components/base/RoomsProvider", () => ({
    useRooms: () => ({
        // Only r1 resolves; r2 is a stale id left on the event.
        getRoom: (room: { id: string }) =>
            room.id === "r1"
                ? { id: "r1", name: "כיתה 1", source: "Custom" }
                : undefined,
        rooms: [{ id: "r1", name: "כיתה 1", source: "Custom" }],
    }),
}));

import { RoomSource } from "@/api-shared/types/room";
import { InstructorsList } from "@/components/schedule/event-component/parts/person";
import { RoomComponent } from "@/components/schedule/event-component/parts/room";
import { Event, EventType } from "@/components/schedule/types/event";

const EVENT = {
    endTime: dayjs("2026-01-14T10:00:00"),
    id: "e1",
    // 7 resolves to a real instructor; the same person also sits in
    // `lecturers`, so the merged list is one chip, not two.
    instructors: [7],
    lecturers: [7],
    locked: false,
    name: "הרצאה",
    rooms: [],
    startTime: dayjs("2026-01-14T09:00:00"),
    type: EventType.LECTURE,
} as unknown as Event;

afterEach(cleanup);

describe("caption pluralization (#624)", () => {
    it("uses the singular for one rendered person chip", () => {
        render(<InstructorsList event={EVENT} />);

        expect(screen.getByLabelText("מבוזר")).toBeTruthy();
    });

    it("uses the plural once a second person is actually rendered", () => {
        render(
            <InstructorsList
                event={{ ...EVENT, instructors: [7, 8], lecturers: [] }}
            />,
        );

        expect(screen.getByLabelText("מבוזרים")).toBeTruthy();
    });

    it("uses the singular when only one of two room ids resolves", () => {
        render(
            <RoomComponent
                roomIds={[
                    { id: "r1", source: RoomSource.Custom },
                    { id: "r2", source: RoomSource.Custom },
                ]}
            />,
        );

        expect(screen.getByLabelText("חדר")).toBeTruthy();
    });
});
