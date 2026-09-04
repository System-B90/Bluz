// @vitest-environment jsdom
import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { activeDrag, useDroppable, isOver } = vi.hoisted(() => ({
    activeDrag: { value: null as unknown },
    isOver: { value: false },
    useDroppable: vi.fn(),
}));

vi.mock("@dnd-kit/core", () => ({ useDroppable }));
vi.mock(
    "@/components/schedule/calendar/instructor-dnd/InstructorDndProvider",
    () => ({ useInstructorDnd: () => ({ activeDrag: activeDrag.value }) }),
);

import { eventDroppableId } from "@/components/schedule/calendar/instructor-dnd/types";
import { useEventDropTarget } from "@/components/schedule/calendar/instructor-dnd/use-event-drop-target";
import { Event } from "@/components/schedule/types/event";
import { tagSx } from "@/components/schedule/event-component/parts/tag-sx";

/**
 * Instructor drag-and-drop registration per rendered event box. A split event
 * is drawn as several boxes, so each piece needs its own droppable id — with
 * one shared id only one piece would ever accept a drop.
 */
const event = { id: "e1", locked: false } as unknown as Event;

const render = (
    over: Partial<Parameters<typeof useEventDropTarget>> = [],
    enabled = true,
    dropKey?: string,
) =>
    renderHook(() =>
        useEventDropTarget(
            (over[ 0 ] as Event) ?? event,
            enabled,
            dropKey,
        ),
    ).result;

beforeEach(() => {
    activeDrag.value = null;
    isOver.value = false;
    useDroppable.mockReset().mockImplementation(() => ({
        setNodeRef: vi.fn(),
        isOver: isOver.value,
    }));
});
afterEach(cleanup);

describe("useEventDropTarget", () => {
    it("registers under the event's own droppable id by default", () => {
        render();

        expect(useDroppable.mock.calls[ 0 ][ 0 ].id).toBe(
            eventDroppableId("e1"),
        );
        expect(useDroppable.mock.calls[ 0 ][ 0 ].data).toEqual({
            kind: "event",
            event,
        });
    });

    it("gives each piece of a split event its own droppable id", () => {
        render([], true, "e1#1");

        expect(useDroppable.mock.calls[ 0 ][ 0 ].id).toBe(
            eventDroppableId("e1#1"),
        );
    });

    it("disables registration for a locked event and for a disabled render", () => {
        render([ { id: "e1", locked: true } as unknown as Event ]);
        expect(useDroppable.mock.calls[ 0 ][ 0 ].disabled).toBe(true);

        cleanup();
        render([], false);
        expect(useDroppable.mock.calls.at(-1)![ 0 ].disabled).toBe(true);
    });

    it("only arms the drop highlight while a drag is in flight", () => {
        expect(render().current.isDropTarget).toBe(false);

        cleanup();
        activeDrag.value = { instructorId: 7 };
        expect(render().current.isDropTarget).toBe(true);
    });

    it("never arms a locked event, even mid-drag", () => {
        activeDrag.value = { instructorId: 7 };

        const result = render([
            { id: "e1", locked: true } as unknown as Event,
        ]);

        expect(result.current.isDropTarget).toBe(false);
    });

    it("reports isOver only together with an active drag", () => {
        isOver.value = true;
        expect(render().current.isOver).toBe(false);

        cleanup();
        activeDrag.value = { instructorId: 7 };
        isOver.value = true;
        expect(render().current.isOver).toBe(true);
    });
});

describe("tagSx", () => {
    it("emphasises a lecturer tag and sorts it first", () => {
        const style = tagSx({ isLecturer: true });

        expect(style.fontWeight).toBe(600);
        expect(style.order).toBe(1);
        expect(style.borderColor).toBe("currentColor");
        expect(style.backgroundColor).toBe("var(--event-emphasis-bg)");
    });

    it("keeps a plain tag transparent and second in order", () => {
        const style = tagSx();

        expect(style.fontWeight).toBe(400);
        expect(style.order).toBe(2);
        expect(style.borderColor).toBe("var(--event-border)");
        expect(style.backgroundColor).toBe("transparent");
        expect(style.color).toBe("inherit");
    });

    it("lets an overcrowding warning outrank the lecturer border", () => {
        expect(
            tagSx({ isLecturer: true, overcrowded: true }).borderColor,
        ).toBe("warning.main");
    });

    it("applies a custom colour when one is given", () => {
        expect(tagSx({ customColor: "#ff0000" }).color).toBe("#ff0000");
    });
});
