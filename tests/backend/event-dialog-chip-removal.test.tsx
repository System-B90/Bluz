// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import dayjs from "dayjs";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Deleting a chip in the event dialog is the removal gesture. The chip stops
 * the select menu from opening, so nothing else will ever report the change —
 * the delete handler has to write it back itself.
 */

vi.mock("@/components/base/CoursesProvider", () => ({
    useCourses: () => ({
        courses: [
            { id: "c1", name: "מסלול א" },
            { id: "c2", name: "מסלול ב" },
        ],
        getCourse: (id: string) =>
            ({ c1: { id: "c1", name: "מסלול א" }, c2: { id: "c2", name: "מסלול ב" } })[
                id
            ],
    }),
}));
vi.mock("@/components/base/RoomsProvider", () => ({
    useRooms: () => ({
        rooms: [
            { id: "r1", name: "כיתה 1", source: "Custom" },
            { id: "r2", name: "כיתה 2", source: "Custom" },
        ],
        getRoom: (room: { id: string }) =>
            ({
                r1: { id: "r1", name: "כיתה 1", source: "Custom" },
                r2: { id: "r2", name: "כיתה 2", source: "Custom" },
            })[room.id],
    }),
}));

import { RoomSource } from "@/api-shared/types/room";
import { CourseField } from "@/components/schedule/event-dialog/CourseField";
import { RoomField } from "@/components/schedule/event-dialog/RoomField";
import { isEndTimeValid } from "@/components/schedule/event-dialog/TimeFields";
import { EventType } from "@/components/schedule/types/event";

afterEach(cleanup);

describe("CourseField chip removal (#615)", () => {
    it("reports the removal instead of only updating local state", () => {
        const onBlurCallback = vi.fn();
        render(
            <CourseField
                event={{ courses: ["c1", "c2"], type: EventType.LECTURE }}
                onBlurCallback={onBlurCallback}
            />,
        );

        // MUI renders the chip's delete affordance with this label.
        fireEvent.click(screen.getAllByTestId("CancelIcon")[0]);

        expect(onBlurCallback).toHaveBeenCalledWith({ courses: ["c2"] });
    });
});

describe("RoomField chip removal (#616)", () => {
    it("reports the removal instead of only updating local state", () => {
        const onBlurCallback = vi.fn();
        render(
            <RoomField
                event={{
                    rooms: [
                        { id: "r1", source: RoomSource.Custom },
                        { id: "r2", source: RoomSource.Custom },
                    ],
                    type: EventType.LECTURE,
                }}
                onBlurCallback={onBlurCallback}
            />,
        );

        fireEvent.click(screen.getAllByTestId("CancelIcon")[0]);

        expect(onBlurCallback).toHaveBeenCalledWith({
            rooms: [{ id: "r2", source: RoomSource.Custom }],
        });
    });
});

describe("isEndTimeValid (#623)", () => {
    const start = dayjs("2026-01-14T09:00:00");

    it("refuses an end before the start", () => {
        expect(isEndTimeValid(start, dayjs("2026-01-14T08:00:00"))).toBe(false);
    });

    it("refuses an end equal to the start — a zero-length event", () => {
        expect(isEndTimeValid(start, start)).toBe(false);
    });

    it("accepts an end after the start", () => {
        expect(isEndTimeValid(start, dayjs("2026-01-14T11:00:00"))).toBe(true);
    });

    it("accepts anything when the event has no start yet", () => {
        expect(isEndTimeValid(undefined, dayjs("2026-01-14T08:00:00"))).toBe(
            true,
        );
    });
});
