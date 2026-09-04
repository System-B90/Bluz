// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The classification row of the event dialog. Its two chip fields used to
 * share one React key (`${id}-${updatedAt}`), so remounting one could reuse
 * the other's element — the rooms row came back holding the courses' chips
 * and vice versa. Rendering both with content is what catches that.
 */

const courses = {
    c1: { id: "c1", name: "מסלול א" },
    c2: { id: "c2", name: "מסלול ב" },
};
const rooms = {
    r1: { id: "r1", name: "כיתה 1", source: "Custom" },
    r2: { id: "r2", name: "כיתה 2", source: "Custom" },
};

vi.mock("@/components/base/CoursesProvider", () => ({
    useCourses: () => ({
        courses: Object.values(courses),
        getCourse: (id: string) => courses[ id as keyof typeof courses ],
    }),
}));
vi.mock("@/components/base/RoomsProvider", () => ({
    useRooms: () => ({
        rooms: Object.values(rooms),
        getRoom: (room: { id: string }) => rooms[ room.id as keyof typeof rooms ],
    }),
}));
vi.mock("@/components/base/HiveSubjectSelect", () => ({
    HiveSubjectSelect: () => <div data-testid="subject-field" />,
}));
vi.mock("@/components/base/HiveModuleSelect", () => ({
    HiveModuleSelect: () => <div data-testid="module-field" />,
}));
vi.mock("@/components/base/HiveLessonSelect", () => ({
    HiveLessonSelect: () => <div data-testid="lesson-field" />,
}));

import { EventClassification } from "@/components/schedule/event-dialog/EventClassification";
import { Event, EventType } from "@/components/schedule/types/event";

const baseEvent = {
    id: "e1",
    updatedAt: "2026-03-01T08:00:00.000Z",
    type: EventType.LECTURE,
    courses: [ "c1" ],
    rooms: [ { id: "r1", source: "Custom" } ],
    subject: 4,
} as unknown as Partial<Event>;

function renderRow(overrides: Partial<Event> = {}) {
    return render(
        <EventClassification
            event={ { ...baseEvent, ...overrides } }
            onUpdate={ vi.fn() }
        />,
    );
}

afterEach(cleanup);

describe("EventClassification", () => {
    it("renders the course and room chips side by side, each with its own value", () => {
        renderRow();

        expect(screen.getByText("מסלול א")).toBeDefined();
        expect(screen.getByText("כיתה 1")).toBeDefined();
    });

    it("keeps the two fields distinct after a remount-forcing update", () => {
        const { rerender } = renderRow();

        rerender(
            <EventClassification
                event={ {
                    ...baseEvent,
                    updatedAt: "2026-03-02T08:00:00.000Z",
                    courses: [ "c2" ],
                    rooms: [ { id: "r2", source: "Custom" } ],
                } as unknown as Partial<Event> }
                onUpdate={ vi.fn() }
            />,
        );

        expect(screen.getByText("מסלול ב")).toBeDefined();
        expect(screen.getByText("כיתה 2")).toBeDefined();
        expect(screen.queryByText("מסלול א")).toBeNull();
        expect(screen.queryByText("כיתה 1")).toBeNull();
    });

    it("shows the Hive fields for a normal event", () => {
        renderRow();

        expect(screen.getByTestId("subject-field")).toBeDefined();
        expect(screen.getByTestId("module-field")).toBeDefined();
        expect(screen.getByTestId("lesson-field")).toBeDefined();
    });

    it("keeps the course and room fields on a fake event, which has no Hive linkage (#102)", () => {
        renderRow({ fake: true } as Partial<Event>);

        expect(screen.getByText("מסלול א")).toBeDefined();
        expect(screen.getByText("כיתה 1")).toBeDefined();
    });

    it("offers the prayer-type field on a prayer", () => {
        renderRow({ type: EventType.PRAYER });

        expect(screen.getAllByText("תפילת").length).toBeGreaterThan(0);
    });
});
