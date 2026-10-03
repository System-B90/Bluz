// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { NumberSpinner, stepLabel } from "@/components/base/NumberSpinner";
import { eventActionLabel, eventFieldLabel } from "@/components/gantt/module-dialog/ModuleEventView";

/** Module-dialog event rows: Hebrew, per-event accessible names (#835). */

afterEach(cleanup);

describe("event row labels", () => {
    it("scopes field names to the event", () => {
        expect(eventFieldLabel("שם", "הרצאה")).toBe("שם — הרצאה");
        expect(eventFieldLabel("שם", undefined)).toBe("שם");
    });

    it("names row actions after the event", () => {
        expect(eventActionLabel("מחיקת", "הרצאה")).toBe('מחיקת "הרצאה"');
        expect(eventActionLabel("מחיקת", undefined)).toBe("מחיקת המופע");
    });
});

describe("NumberSpinner", () => {
    it("labels its steppers in Hebrew, never English", () => {
        render(<NumberSpinner unitToggle={false} value={30} />);
        expect(screen.getByRole("button", { name: "הקטנה" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "הגדלה" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: /Increase|Decrease/ })).toBeNull();
    });

    it("names the input and scopes the steppers when given ariaLabel", () => {
        render(<NumberSpinner ariaLabel="משך — הרצאה" unitToggle={false} value={30} />);
        expect(screen.getByRole("textbox", { name: "משך — הרצאה" })).toBeTruthy();
        expect(screen.getByRole("button", { name: stepLabel("הגדלה", "משך — הרצאה") })).toBeTruthy();
    });
});
