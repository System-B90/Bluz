// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "New syllabus" must open the syllabus it just made (#758).
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
import { CreateSyllabusButton } from "@/components/gantt/curriculum-view/components/syllabuses-actions-box/CreateSyllabusButton";

const CID = "c1" as GanttCurriculumId;

function click() {
    render(<CreateSyllabusButton curriculumId={CID} />);
    fireEvent.click(screen.getByRole("button", { name: /סילבוס חדש/ }));
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("CreateSyllabusButton (#758)", () => {
    it("opens the dialog on the created syllabus", async () => {
        createSyllabus.mockResolvedValue({ id: "s_new" });
        click();
        await waitFor(() => expect(openSyllabusDialog).toHaveBeenCalledWith("s_new"));
    });

    it("opens it exactly once", async () => {
        createSyllabus.mockResolvedValue({ id: "s_new" });
        click();
        await waitFor(() => expect(openSyllabusDialog).toHaveBeenCalled());
        expect(openSyllabusDialog).toHaveBeenCalledTimes(1);
    });

    it("opens the real id, never the optimistic temp id", async () => {
        createSyllabus.mockResolvedValue({ id: "s_real" });
        click();
        await waitFor(() => expect(openSyllabusDialog).toHaveBeenCalled());
        expect(openSyllabusDialog.mock.calls[0][0]).not.toMatch(/^temp-/);
    });

    it("creates it under the current curriculum with the default title", async () => {
        createSyllabus.mockResolvedValue({ id: "s_new" });
        click();
        await waitFor(() => expect(createSyllabus).toHaveBeenCalledWith("סילבוס חדש", CID));
    });

    it("does not open a dialog when creation fails", async () => {
        createSyllabus.mockRejectedValue(new Error("boom"));
        click();
        await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
        expect(openSyllabusDialog).not.toHaveBeenCalled();
    });

    it("does not open a dialog when creation resolves empty", async () => {
        createSyllabus.mockResolvedValue(undefined);
        click();
        await new Promise((r) => setTimeout(r, 0));
        expect(openSyllabusDialog).not.toHaveBeenCalled();
    });

    it("waits for the server before opening", () => {
        createSyllabus.mockReturnValue(new Promise(() => undefined));
        click();
        expect(openSyllabusDialog).not.toHaveBeenCalled();
    });
});
