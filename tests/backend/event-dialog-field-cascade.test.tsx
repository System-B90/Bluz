// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The event dialog's fields cascade: a subject scopes the modules and lessons
 * under it, and an event type decides whether lecturers apply at all. Both
 * used to write updates the user never asked for.
 */

vi.mock("@/components/base/HiveSubjectsProvider", () => ({
    useHiveSubjects: () => ({
        subjects: [
            { id: 1, name: "רשתות" },
            { id: 2, name: "מערכות הפעלה" },
        ],
    }),
}));

import { EventTypeField } from "@/components/schedule/event-dialog/EventTypeField";
import { SubjectField } from "@/components/schedule/event-dialog/SubjectField";
import { EventType } from "@/components/schedule/types/event";

afterEach(cleanup);

function pick(comboboxIndex: number, optionText: string) {
    fireEvent.mouseDown(screen.getAllByRole("combobox")[comboboxIndex]);
    fireEvent.click(screen.getByRole("option", { name: optionText }));
}

describe("SubjectField cascade (#619)", () => {
    it("clears the module and lesson when the subject changes", () => {
        const onEventChange = vi.fn();
        render(
            <SubjectField
                event={{
                    hiveLesson: 55,
                    hiveModule: 9,
                    subject: 1,
                    type: EventType.EXERCISE,
                }}
                onEventChange={onEventChange}
            />,
        );

        pick(0, "מערכות הפעלה");

        // Modules and lessons belong to a subject; keeping them pointed the
        // saved event at a module from the subject the user just left.
        expect(onEventChange).toHaveBeenCalledWith({
            hiveLesson: null,
            hiveModule: undefined,
            subject: 2,
        });
    });
});

describe("EventTypeField dropdown close (#617)", () => {
    it("writes nothing when the dropdown closes without a new pick", () => {
        const onBlurCallback = vi.fn();
        render(
            <EventTypeField
                event={{ type: EventType.LECTURE }}
                onBlurCallback={onBlurCallback}
            />,
        );

        // Open, then dismiss with Esc — the user changed nothing.
        fireEvent.mouseDown(screen.getByRole("combobox"));
        fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });

        // The unconditional write reset splitAcrossBreaks to the type default
        // and wiped lecturers for non-lecturer types.
        expect(onBlurCallback).not.toHaveBeenCalled();
    });

    it("still commits the type, its split default and lecturer clearing on a real pick", () => {
        const onBlurCallback = vi.fn();
        render(
            <EventTypeField
                event={{ type: EventType.LECTURE }}
                onBlurCallback={onBlurCallback}
            />,
        );

        pick(0, EventType.EXERCISE);

        expect(onBlurCallback).toHaveBeenCalledTimes(1);
        const [update] = onBlurCallback.mock.calls[0];
        expect(update.type).toBe(EventType.EXERCISE);
        expect(update).toHaveProperty("splitAcrossBreaks");
        // An exercise has no lecturers, so any carried over are dropped.
        expect(update.lecturers).toEqual([]);
    });
});
