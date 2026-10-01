// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The syllabus dialog (#714) is one instance that stays mounted while closed.
 * Its local title must follow the syllabus across reopenings, and a blank
 * title must never be saved.
 */

const { updateSyllabus, store } = vi.hoisted(() => ({
    updateSyllabus: vi.fn(async () => undefined),
    store: {
        syllabus: { id: "s1", title: "ישן", description: "", modules: [], shuffles: [] },
    },
}));

vi.mock("notistack", () => ({ useSnackbar: () => ({ enqueueSnackbar: vi.fn() }) }));
vi.mock("@/components/gantt/state/hooks/UseSyllabus", () => ({
    useSyllabus: () => store.syllabus,
}));
vi.mock("@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions", () => ({
    useSyllabusActions: () => ({
        updateSyllabus,
        unlinkSyllabusFromCurriculum: vi.fn(),
    }),
}));
vi.mock("@/components/gantt/syllabus-card/ModulesTable", () => ({
    ModulesTable: () => null,
}));
vi.mock("@/components/gantt/syllabus-dialog/ShufflesSection", () => ({
    ShufflesSection: () => null,
}));
vi.mock("@/components/gantt/syllabus-dialog/SyllabusImportExportButton", () => ({
    SyllabusImportExportButton: () => null,
}));
vi.mock("@/components/schedule/event-dialog/ColorPickerField", () => ({
    ColorPickerField: ({ onUpdate }: { onUpdate: (u: { color?: string }) => void }) => (
        <>
            <button onClick={() => onUpdate({ color: "c9" })} type="button">pick</button>
            <button onClick={() => onUpdate({ color: undefined })} type="button">reset</button>
        </>
    ),
}));
vi.mock("@/components/gantt/syllabus-dialog/SyllabusLinksSection", () => ({
    SyllabusLinksSection: () => null,
}));

import {
    GanttCurriculumId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { SyllabusDialog } from "@/components/gantt/syllabus-dialog";

const props = {
    setOpen: vi.fn(),
    curriculumId: "c1" as GanttCurriculumId,
    syllabusId: "s1" as GanttSyllabusId,
};

const titleField = () => screen.getByLabelText(/שם הסילבוס/) as HTMLInputElement;

beforeEach(() => {
    vi.clearAllMocks();
    store.syllabus = { ...store.syllabus, title: "ישן" };
});
afterEach(cleanup);

describe("SyllabusDialog title field", () => {
    it("shows the current title when the same syllabus is reopened after a rename", () => {
        const { rerender } = render(<SyllabusDialog {...props} open />);
        rerender(<SyllabusDialog {...props} open={false} />);

        store.syllabus = { ...store.syllabus, title: "חדש" };
        rerender(<SyllabusDialog {...props} open />);

        expect(titleField().value).toBe("חדש");
        fireEvent.blur(titleField());
        expect(updateSyllabus).not.toHaveBeenCalled();
    });

    it("never saves a blank title and restores the saved one", () => {
        render(<SyllabusDialog {...props} open />);

        fireEvent.change(titleField(), { target: { value: "   " } });
        expect(screen.getByText(/חייב להיות שם/)).toBeTruthy();
        fireEvent.blur(titleField());

        expect(updateSyllabus).not.toHaveBeenCalled();
        expect(titleField().value).toBe("ישן");
    });

    it("saves a trimmed title", () => {
        render(<SyllabusDialog {...props} open />);

        fireEvent.change(titleField(), { target: { value: " חדש " } });
        fireEvent.blur(titleField());

        expect(updateSyllabus).toHaveBeenCalledWith("s1", { title: "חדש" });
    });
});

describe("SyllabusDialog default color", () => {
    it("saves the picked color", () => {
        render(<SyllabusDialog {...props} open />);
        fireEvent.click(screen.getByText("pick"));
        expect(updateSyllabus).toHaveBeenCalledWith("s1", { color: "c9" });
    });

    it("clears the color back to null", () => {
        store.syllabus = { ...store.syllabus, color: "c9" } as typeof store.syllabus;
        render(<SyllabusDialog {...props} open />);
        fireEvent.click(screen.getByText("reset"));
        expect(updateSyllabus).toHaveBeenCalledWith("s1", { color: null });
    });
});
