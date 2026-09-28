// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EventDialogHeader } from "@/components/gantt/event-dialog/DialogHeader";

/** The event dialog breadcrumb: syllabus and module names open their dialogs (#749). */

afterEach(cleanup);

describe("EventDialogHeader crumbs", () => {
    it("opens the syllabus on click and on Enter", () => {
        const onSyllabusClick = vi.fn();
        render(
            <EventDialogHeader
                eventTitle="הרצאה"
                moduleTitle="מבוא"
                onModuleClick={() => {}}
                onSyllabusClick={onSyllabusClick}
                syllabusTitle="פיקוד"
            />,
        );
        const crumb = screen.getByRole("link", { name: "פיקוד" });
        fireEvent.click(crumb);
        fireEvent.keyDown(crumb, { key: "Enter" });
        expect(onSyllabusClick).toHaveBeenCalledTimes(2);
    });

    it("renders plain text without a handler", () => {
        render(<EventDialogHeader eventTitle="הרצאה" moduleTitle="מבוא" syllabusTitle="פיקוד" />);
        expect(screen.queryByRole("link")).toBeNull();
        expect(screen.getByText("פיקוד")).toBeTruthy();
    });
});
