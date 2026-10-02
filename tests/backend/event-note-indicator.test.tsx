// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
    EVENT_NOTE_PREVIEW_MAX,
    EventNoteIndicator,
    eventNotePreview,
} from "@/components/gantt/EventNoteIndicator";

describe("eventNotePreview (#773)", () => {
    it("is null for missing or blank notes", () => {
        expect(eventNotePreview(null)).toBeNull();
        expect(eventNotePreview(undefined)).toBeNull();
        expect(eventNotePreview("   \n ")).toBeNull();
    });

    it("trims the note", () => {
        expect(eventNotePreview("  להביא מקרן  ")).toBe("להביא מקרן");
    });

    it("truncates long notes with an ellipsis", () => {
        const preview = eventNotePreview("א".repeat(EVENT_NOTE_PREVIEW_MAX + 50));
        expect(preview).toHaveLength(EVENT_NOTE_PREVIEW_MAX + 1);
        expect(preview?.endsWith("…")).toBe(true);
    });
});

describe("EventNoteIndicator (#773)", () => {
    afterEach(cleanup);

    it("renders nothing without a note", () => {
        render(<EventNoteIndicator comment="  " />);
        expect(screen.queryByTestId("event-note-indicator")).toBeNull();
    });

    it("shows the note on hover", async () => {
        render(<EventNoteIndicator comment={ "שורה 1\nשורה 2" } />);
        const icon = screen.getByTestId("event-note-indicator");
        fireEvent.mouseOver(icon);
        expect(await screen.findByText(/שורה 1/)).toBeTruthy();
    });
});
