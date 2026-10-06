// @vitest-environment jsdom

import { createTheme, ThemeProvider } from "@mui/material/styles";
import { cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * "New syllabus" opens the syllabus dialog as a draft (#881): nothing is saved
 * until the name is committed (#845), and then the same dialog carries on
 * editing the real syllabus (#758).
 */

const createSyllabus = vi.fn();
const updateSyllabus = vi.fn();
const openSyllabusDraft = vi.fn();
const enqueueSnackbar = vi.fn();

vi.mock("notistack", () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock("@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions", () => ({
    useSyllabusActions: () => ({ createSyllabus, updateSyllabus, unlinkSyllabusFromCurriculum: vi.fn() }),
}));
vi.mock("@/components/gantt/state/hooks/UseSyllabus", () => ({ useSyllabus: () => undefined }));
vi.mock("@/components/gantt/state/context", () => ({
    useCurriculumProviderActions: () => ({ openSyllabusDraft }),
}));
vi.mock("@/components/app-commands/use-command", () => ({ useCommand: () => undefined }));
// The sections below need a real syllabus; a draft must not render them.
vi.mock("@/components/gantt/syllabus-card/ModulesTable", () => ({ ModulesTable: () => <div>modules-table</div> }));
vi.mock("@/components/gantt/syllabus-dialog/ShufflesSection", () => ({ ShufflesSection: () => <div>shuffles</div> }));
vi.mock("@/components/gantt/syllabus-dialog/SyllabusLinksSection", () => ({ SyllabusLinksSection: () => <div>links</div> }));
vi.mock("@/components/gantt/syllabus-dialog/SyllabusImportExportButton", () => ({ SyllabusImportExportButton: () => null }));
vi.mock("@/components/schedule/event-dialog/ColorPickerField", () => ({ ColorPickerField: () => null }));

import { GanttCurriculumId, GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { CreateSyllabusButton } from "@/components/gantt/curriculum-view/components/syllabuses-actions-box/CreateSyllabusButton";
import { DRAFT_SECTIONS_HINT, DRAFT_TITLE, SyllabusDialog } from "@/components/gantt/syllabus-dialog";

const CID = "c1" as GanttCurriculumId;
const theme = createTheme({ cssVariables: true });
const render = (ui: React.ReactElement) => rtlRender(ui, {
    wrapper: ({ children }) => <ThemeProvider theme={ theme }>{ children }</ThemeProvider>,
});

function renderDraft(onDraftCreated = vi.fn(), setOpen = vi.fn()) {
    render(
        <SyllabusDialog
            curriculumId={ CID }
            draft
            onDraftCreated={ onDraftCreated }
            open
            setOpen={ setOpen }
            syllabusId={ null }
        />,
    );
    const name = screen.getByRole("textbox", { name: /שם הסילבוס/ });
    const description = screen.getByRole("textbox", { name: /תיאור/ });
    return { name, description, onDraftCreated, setOpen };
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("CreateSyllabusButton (#881)", () => {
    it("opens a draft and creates nothing", () => {
        render(<CreateSyllabusButton />);
        fireEvent.click(screen.getByRole("button", { name: /סילבוס חדש/ }));
        expect(openSyllabusDraft).toHaveBeenCalledTimes(1);
        expect(createSyllabus).not.toHaveBeenCalled();
    });
});

describe("SyllabusDialog draft (#881)", () => {
    it("shows the draft title and holds back the id-only sections", () => {
        renderDraft();
        expect(screen.getByText(DRAFT_TITLE)).toBeTruthy();
        expect(screen.getAllByText(DRAFT_SECTIONS_HINT).length).toBeGreaterThan(0);
        expect(screen.queryByText("modules-table")).toBeNull();
        expect(screen.queryByText("shuffles")).toBeNull();
        expect(screen.queryByRole("button", { name: "הסרה מהגאנט" })).toBeNull();
    });

    it("creates nothing on open or for a blank name", () => {
        const { name } = renderDraft();
        fireEvent.change(name, { target: { value: "   " } });
        fireEvent.keyDown(name, { key: "Enter" });
        expect(createSyllabus).not.toHaveBeenCalled();
    });

    it("creates on Enter with the trimmed name, then hands over the real id", async () => {
        createSyllabus.mockResolvedValue({ id: "s_new" });
        const { name, onDraftCreated } = renderDraft();
        fireEvent.change(name, { target: { value: "  פיקוד  " } });
        fireEvent.keyDown(name, { key: "Enter" });
        await waitFor(() => expect(onDraftCreated).toHaveBeenCalledWith("s_new" as GanttSyllabusId));
        expect(createSyllabus).toHaveBeenCalledWith("פיקוד", CID);
    });

    it("Enter and the blur it causes create one syllabus", () => {
        createSyllabus.mockReturnValue(new Promise(() => undefined));
        const { name, description } = renderDraft();
        fireEvent.change(name, { target: { value: "פיקוד" } });
        fireEvent.keyDown(name, { key: "Enter" });
        fireEvent.blur(name, { relatedTarget: description });
        expect(createSyllabus).toHaveBeenCalledTimes(1);
    });

    it("moving on to the next field commits the name", () => {
        createSyllabus.mockReturnValue(new Promise(() => undefined));
        const { name, description } = renderDraft();
        fireEvent.change(name, { target: { value: "פיקוד" } });
        fireEvent.blur(name, { relatedTarget: description });
        expect(createSyllabus).toHaveBeenCalledTimes(1);
    });

    it("cancelling or clicking away does not", () => {
        const { name, setOpen } = renderDraft();
        fireEvent.change(name, { target: { value: "פיקוד" } });
        const cancel = screen.getByRole("button", { name: "ביטול" });
        fireEvent.blur(name, { relatedTarget: cancel });
        fireEvent.blur(name, { relatedTarget: null });
        fireEvent.click(cancel);
        expect(createSyllabus).not.toHaveBeenCalled();
        expect(setOpen).toHaveBeenCalledWith(false);
    });

    it("keeps a description typed before the name", async () => {
        createSyllabus.mockResolvedValue({ id: "s_new" });
        updateSyllabus.mockResolvedValue(undefined);
        const { name, description } = renderDraft();
        fireEvent.change(description, { target: { value: "תיאור ראשון" } });
        fireEvent.change(name, { target: { value: "פיקוד" } });
        fireEvent.keyDown(name, { key: "Enter" });
        await waitFor(() => expect(updateSyllabus).toHaveBeenCalledWith("s_new", { description: "תיאור ראשון" }));
    });

    it("reports a failed create and stays a draft", async () => {
        createSyllabus.mockRejectedValue(new Error("boom"));
        const { name, onDraftCreated } = renderDraft();
        fireEvent.change(name, { target: { value: "פיקוד" } });
        fireEvent.keyDown(name, { key: "Enter" });
        await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
        expect(onDraftCreated).not.toHaveBeenCalled();
    });
});
