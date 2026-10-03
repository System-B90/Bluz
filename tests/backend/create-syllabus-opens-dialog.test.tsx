// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "New syllabus" asks for a name, creates only on confirm (#845), and then
 * opens the syllabus it just made (#758).
 */

const createSyllabus = vi.fn();
const openSyllabusDialog = vi.fn();
const enqueueSnackbar = vi.fn();

vi.mock("notistack", () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock("@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions", () => ({
    useSyllabusActions: () => ({ createSyllabus }),
}));
vi.mock("@/components/gantt/state/context", () => ({
    useCurriculumProviderActions: () => ({ openSyllabusDialog }),
}));
vi.mock("@/components/app-commands/use-command", () => ({ useCommand: () => undefined }));

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import {
    CREATE_SYLLABUS_CONFIRM,
    CreateSyllabusButton,
    NEW_SYLLABUS_NAME_LABEL,
} from "@/components/gantt/curriculum-view/components/syllabuses-actions-box/CreateSyllabusButton";

const CID = "c1" as GanttCurriculumId;

function openPrompt() {
    render(<CreateSyllabusButton curriculumId={CID} />);
    fireEvent.click(screen.getByRole("button", { name: /סילבוס חדש/ }));
}

function create(name = "פיקוד") {
    openPrompt();
    fireEvent.change(screen.getByRole("textbox", { name: new RegExp(NEW_SYLLABUS_NAME_LABEL) }), { target: { value: name } });
    fireEvent.click(screen.getByRole("button", { name: CREATE_SYLLABUS_CONFIRM }));
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("CreateSyllabusButton (#845)", () => {
    it("creates nothing when the button is merely clicked", () => {
        openPrompt();
        expect(createSyllabus).not.toHaveBeenCalled();
    });

    it("cannot create without a real name", () => {
        openPrompt();
        const confirm = screen.getByRole("button", { name: CREATE_SYLLABUS_CONFIRM });
        expect(confirm).toHaveProperty("disabled", true);
        fireEvent.change(screen.getByRole("textbox", { name: new RegExp(NEW_SYLLABUS_NAME_LABEL) }), { target: { value: "   " } });
        expect(confirm).toHaveProperty("disabled", true);
    });

    it("cancelling leaves no record", () => {
        openPrompt();
        fireEvent.click(screen.getByRole("button", { name: "ביטול" }));
        expect(createSyllabus).not.toHaveBeenCalled();
    });

    it("creates it under the current curriculum with the typed, trimmed name", async () => {
        createSyllabus.mockResolvedValue({ id: "s_new" });
        create("  פיקוד  ");
        await waitFor(() => expect(createSyllabus).toHaveBeenCalledWith("פיקוד", CID));
    });

    it("a double confirm creates only one syllabus", async () => {
        createSyllabus.mockReturnValue(new Promise(() => undefined));
        create();
        fireEvent.click(screen.getByRole("button", { name: CREATE_SYLLABUS_CONFIRM }));
        expect(createSyllabus).toHaveBeenCalledTimes(1);
    });
});

describe("CreateSyllabusButton (#758)", () => {
    it("opens the dialog on the created syllabus, exactly once", async () => {
        createSyllabus.mockResolvedValue({ id: "s_new" });
        create();
        await waitFor(() => expect(openSyllabusDialog).toHaveBeenCalledWith("s_new"));
        expect(openSyllabusDialog).toHaveBeenCalledTimes(1);
    });

    it("opens the real id, never the optimistic temp id", async () => {
        createSyllabus.mockResolvedValue({ id: "s_real" });
        create();
        await waitFor(() => expect(openSyllabusDialog).toHaveBeenCalled());
        expect(openSyllabusDialog.mock.calls[0][0]).not.toMatch(/^temp-/);
    });

    it("does not open a dialog when creation fails", async () => {
        createSyllabus.mockRejectedValue(new Error("boom"));
        create();
        await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
        expect(openSyllabusDialog).not.toHaveBeenCalled();
    });

    it("does not open a dialog when creation resolves empty", async () => {
        createSyllabus.mockResolvedValue(undefined);
        create();
        await new Promise((r) => setTimeout(r, 0));
        expect(openSyllabusDialog).not.toHaveBeenCalled();
    });

    it("waits for the server before opening", () => {
        createSyllabus.mockReturnValue(new Promise(() => undefined));
        create();
        expect(openSyllabusDialog).not.toHaveBeenCalled();
    });
});
