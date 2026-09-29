// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The syllabus dialog's import/export button (#757).
 */

const { importSyllabus, openSyllabusDialog, enqueueSnackbar, apiExportSyllabus } = vi.hoisted(() => ({
    importSyllabus: vi.fn(),
    openSyllabusDialog: vi.fn(),
    enqueueSnackbar: vi.fn(),
    apiExportSyllabus: vi.fn(),
}));

vi.mock("notistack", () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock("@/components/app-commands/use-command", () => ({ useCommand: () => undefined }));
vi.mock("@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions", () => ({
    useSyllabusActions: () => ({ importSyllabus }),
}));
vi.mock("@/components/gantt/state/context", () => ({
    useCurriculumProviderActions: () => ({ openSyllabusDialog }),
}));
vi.mock("@/api-client/gantt/syllabus", () => ({ apiExportSyllabus }));

import { GanttCurriculumId, GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { SyllabusImportExportButton } from "@/components/gantt/syllabus-dialog/SyllabusImportExportButton";

const CID = "c1" as GanttCurriculumId;
const SID = "s1" as GanttSyllabusId;

function mount() {
    const { container } = render(<SyllabusImportExportButton curriculumId={CID} syllabusId={SID} title="אלגברה" />);
    return container.querySelector("input[type=file]") as HTMLInputElement;
}

function pick(input: HTMLInputElement, text: string) {
    const file = new File([text], "s.json", { type: "application/json" });
    fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("SyllabusImportExportButton (#757)", () => {
    it("renders a labelled trigger", () => {
        mount();
        expect(screen.getByRole("button", { name: "ייבוא / ייצוא סילבוס" })).toBeTruthy();
    });

    it("offers export and import in its menu", () => {
        mount();
        fireEvent.click(screen.getByRole("button", { name: "ייבוא / ייצוא סילבוס" }));
        expect(screen.getByText("ייצוא הסילבוס")).toBeTruthy();
        expect(screen.getByText("ייבוא סילבוס")).toBeTruthy();
    });

    it("accepts JSON files only", () => {
        expect(mount().accept).toBe(".json");
    });

    it("imports the chosen file into this curriculum", async () => {
        importSyllabus.mockResolvedValue({ id: "s_new" });
        pick(mount(), JSON.stringify({ kind: "bluz-syllabus" }));
        await waitFor(() => expect(importSyllabus).toHaveBeenCalledWith(CID, { kind: "bluz-syllabus" }));
    });

    it("opens the imported syllabus", async () => {
        importSyllabus.mockResolvedValue({ id: "s_new" });
        pick(mount(), "{}");
        await waitFor(() => expect(openSyllabusDialog).toHaveBeenCalledWith("s_new"));
    });

    it("confirms a successful import", async () => {
        importSyllabus.mockResolvedValue({ id: "s_new" });
        pick(mount(), "{}");
        await waitFor(() =>
            expect(enqueueSnackbar).toHaveBeenCalledWith("הסילבוס יובא בהצלחה!", { variant: "success" }),
        );
    });

    it("reports a server rejection and stays put", async () => {
        importSyllabus.mockRejectedValue(new Error("bad"));
        pick(mount(), "{}");
        await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
        expect(openSyllabusDialog).not.toHaveBeenCalled();
    });

    it("reports a file that is not JSON without calling the server", async () => {
        pick(mount(), "not json");
        await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
        expect(importSyllabus).not.toHaveBeenCalled();
    });

    it("ignores an empty pick", () => {
        fireEvent.change(mount(), { target: { files: [] } });
        expect(importSyllabus).not.toHaveBeenCalled();
    });

    it("exports this syllabus with the current curriculum's durations", async () => {
        apiExportSyllabus.mockResolvedValue({ kind: "bluz-syllabus" });
        globalThis.URL.createObjectURL = vi.fn(() => "blob:x");
        globalThis.URL.revokeObjectURL = vi.fn();
        mount();
        fireEvent.click(screen.getByRole("button", { name: "ייבוא / ייצוא סילבוס" }));
        fireEvent.click(screen.getByText("ייצוא הסילבוס"));
        await waitFor(() => expect(apiExportSyllabus).toHaveBeenCalledWith(SID, CID));
    });
});
