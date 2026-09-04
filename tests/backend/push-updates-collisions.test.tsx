// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import dayjs from "dayjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DiffDetailsTable } from "@/components/schedule/offline-dialogs/push-updates-dialog/DiffDetailsTable";
import { EventCollisionsList } from "@/components/schedule/offline-dialogs/push-updates-dialog/EventCollisionsList";
import { CollisionStates } from "@/components/schedule/offline-dialogs/push-updates-dialog/types";
import { Event, EventType } from "@/components/schedule/types/event";

/**
 * The push-updates dialog decides which offline edits survive. A wrong
 * selection reverts real work, and a wrong diff caption tells the user their
 * event was deleted when it never was.
 */

function makeEvent(overrides: Partial<Event> = {}): Event {
    return {
        courses: [],
        endTime: dayjs("2026-01-14T10:00:00"),
        id: "e1",
        instructors: [],
        locked: false,
        name: "הרצאה",
        notes: "",
        rooms: [],
        startTime: dayjs("2026-01-14T09:00:00"),
        type: EventType.LECTURE,
        ...overrides,
    } as unknown as Event;
}

const COLLISIONS: CollisionStates = {
    e1: {
        capturedVersion: makeEvent(),
        conflicting: false,
        localModifiedEvent: makeEvent({ name: "הרצאה מעודכנת" }),
        serverVersion: makeEvent(),
    },
    e2: {
        capturedVersion: makeEvent({ id: "e2" }),
        conflicting: true,
        localModifiedEvent: makeEvent({ id: "e2", name: "סדנה" }),
        serverVersion: makeEvent({ id: "e2" }),
    },
};

afterEach(cleanup);

describe("EventCollisionsList select-all (#630)", () => {
    it("selects everything from a partial selection, rather than clearing it", () => {
        // The dialog opens with the non-conflicting edits pre-selected, so
        // this is the state the user actually meets. Clearing here, then
        // submitting, reverted every local edit.
        const setSelected = vi.fn();
        render(
            <EventCollisionsList
                collisionStates={COLLISIONS}
                selected={["e1"]}
                setSelected={setSelected}
            />,
        );

        fireEvent.click(screen.getByLabelText("בחירת הכל"));

        const [updater] = setSelected.mock.calls[0];
        expect(updater(["e1"])).toEqual(["e1", "e2"]);
    });

    it("clears the selection only when everything is already selected", () => {
        const setSelected = vi.fn();
        render(
            <EventCollisionsList
                collisionStates={COLLISIONS}
                selected={["e1", "e2"]}
                setSelected={setSelected}
            />,
        );

        fireEvent.click(screen.getByLabelText("בחירת הכל"));

        const [updater] = setSelected.mock.calls[0];
        expect(updater(["e1", "e2"])).toEqual([]);
    });

    it("selects everything from an empty selection", () => {
        const setSelected = vi.fn();
        render(
            <EventCollisionsList
                collisionStates={COLLISIONS}
                selected={[]}
                setSelected={setSelected}
            />,
        );

        fireEvent.click(screen.getByLabelText("בחירת הכל"));

        const [updater] = setSelected.mock.calls[0];
        expect(updater([])).toEqual(["e1", "e2"]);
    });
});

describe("DiffDetailsTable placeholders (#631)", () => {
    it("does not claim the event was deleted for an absent optional field", () => {
        // `notes` was added locally to an event that never carried the key,
        // so it is simply missing on the other two versions.
        const withoutNotes = makeEvent();
        delete (withoutNotes as Partial<Event>).notes;

        render(
            <DiffDetailsTable
                capturedVersion={withoutNotes}
                eventId="e1"
                localModifiedEvent={makeEvent({ notes: "הערה חדשה" })}
                serverVersion={withoutNotes}
            />,
        );

        expect(screen.queryByText("המופע עצמו נמחק")).toBeNull();
    });

    it("still says so when a whole version really is gone", () => {
        render(
            <DiffDetailsTable
                capturedVersion={makeEvent()}
                eventId="e1"
                localModifiedEvent={makeEvent({ notes: "הערה חדשה" })}
                serverVersion={undefined}
            />,
        );

        expect(screen.getAllByText("המופע עצמו נמחק").length).toBeGreaterThan(0);
    });
});
