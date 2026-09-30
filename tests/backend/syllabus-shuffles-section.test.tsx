// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The shuffles section of the syllabus dialog (#714): adding a look-alike of an
 * existing name must be caught, and a delete must not fire its usage check
 * twice while the first one is still in flight.
 */

const { updateSyllabus, getShuffleUsages, applyShuffles, enqueueSnackbar, syllabus, apiGetClasses } = vi.hoisted(() => ({
    applyShuffles: vi.fn(async () => ({ events: [], modules: [] })),
    apiGetClasses: vi.fn(async () => [] as Array<unknown>),
    updateSyllabus: vi.fn(async () => undefined),
    getShuffleUsages: vi.fn(),
    enqueueSnackbar: vi.fn(),
    syllabus: {
        id: "s1",
        title: "סילבוס",
        modules: [],
        shuffles: [ "א", "ב" ],
        shuffleHiveGroups: {} as Record<string, number>,
    },
}));

vi.mock("notistack", () => ({ useSnackbar: () => ({ enqueueSnackbar }) }));
vi.mock("@/api-client/gantt", () => ({
    ganttApi: { getShuffleUsages, applyShuffles },
}));
vi.mock("@/api-client/hive", () => ({ apiGetClasses }));
vi.mock("@/components/gantt/state/hooks/UseSyllabus", () => ({
    useSyllabus: () => syllabus,
}));
vi.mock("@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions", () => ({
    useSyllabusActions: () => ({ updateSyllabus }),
}));
vi.mock("@/components/base/IterationProvider", () => ({
    useActiveIterationHiveUrl: () => "https://hive.test",
}));
vi.mock("@/components/gantt/state/context", () => ({
    useCurriculumProviderActions: () => ({ dispatch: vi.fn() }),
    useCurriculumState: () => ({ syllabuses: {}, modules: {}, events: {} }),
}));

import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import {
    ShufflesSection,
    shuffleUsageLabel,
} from "@/components/gantt/syllabus-dialog/ShufflesSection";

const SID = "s1" as GanttSyllabusId;

beforeEach(() => {
    vi.clearAllMocks();
    syllabus.shuffleHiveGroups = {};
});
afterEach(cleanup);

describe("ShufflesSection", () => {
    it("rejects a name that differs from an existing one only by whitespace", () => {
        render(<ShufflesSection syllabusId={SID} />);

        fireEvent.change(screen.getByLabelText("שם השאפל"), {
            target: { value: "  א " },
        });
        fireEvent.click(screen.getByRole("button", { name: "הוספה" }));

        expect(updateSyllabus).not.toHaveBeenCalled();
        expect(enqueueSnackbar).toHaveBeenCalledWith(
            expect.stringMatching(/כבר קיים/),
            expect.anything(),
        );
    });

    it("adds the normalized form of a new name", () => {
        render(<ShufflesSection syllabusId={SID} />);

        fireEvent.change(screen.getByLabelText("שם השאפל"), {
            target: { value: " ג  ד " },
        });
        fireEvent.click(screen.getByRole("button", { name: "הוספה" }));

        expect(updateSyllabus).toHaveBeenCalledWith(SID, {
            shuffles: [ "א", "ב", "ג ד" ],
            shuffleDescriptions: {},
        });
    });

    it("fills a new shuffle's description from its same-named Hive group", async () => {
        apiGetClasses.mockResolvedValueOnce([
            { id: 7, name: "ג", description: " מחזור ג ", display_name: "ג" },
        ]);
        render(<ShufflesSection syllabusId={SID} />);
        await screen.findAllByText("לא ב-Hive");

        fireEvent.change(screen.getByLabelText("שם השאפל"), {
            target: { value: "ג" },
        });
        fireEvent.click(screen.getByRole("button", { name: "הוספה" }));

        expect(updateSyllabus).toHaveBeenCalledWith(SID, {
            shuffles: [ "א", "ב", "ג" ],
            shuffleDescriptions: { ג: "מחזור ג" },
        });
    });

    it("marks which shuffles have a Hive student group", async () => {
        apiGetClasses.mockResolvedValueOnce([
            { id: 1, name: "א", description: "", display_name: "א" },
        ]);
        render(<ShufflesSection syllabusId={SID} />);

        expect(await screen.findByText("Hive")).toBeTruthy();
        expect(screen.getAllByText("לא ב-Hive")).toHaveLength(1);
    });

    it("checks usages once per delete, however many times it is clicked", async () => {
        let resolve: (value: unknown) => void = () => undefined;
        getShuffleUsages.mockReturnValueOnce(new Promise((r) => (resolve = r)));
        render(<ShufflesSection syllabusId={SID} />);

        const button = screen.getByRole("button", { name: "מחיקת השאפל א" });
        fireEvent.click(button);
        fireEvent.click(button);
        fireEvent.click(screen.getByRole("button", { name: "מחיקת השאפל ב" }));

        expect(getShuffleUsages).toHaveBeenCalledTimes(1);

        resolve({ events: [], modules: [] });
        await waitFor(() =>
            expect(updateSyllabus).toHaveBeenCalledWith(SID, {
                shuffles: [ "ב" ],
                shuffleDescriptions: {},
            }),
        );
        await waitFor(() => expect((button as HTMLButtonElement).disabled).toBe(false));
    });
});

describe("ShufflesSection rename (#774)", () => {
    const startRename = (name: string) =>
        fireEvent.click(screen.getByRole("button", { name: `שינוי שם השאפל ${name}` }));
    const renameField = (name: string) =>
        screen.getByLabelText(`שם חדש לשאפל ${name}`);

    it("renames a shuffle through the cascade endpoint", async () => {
        render(<ShufflesSection syllabusId={SID} />);

        startRename("א");
        fireEvent.change(renameField("א"), { target: { value: " ג " } });
        fireEvent.keyDown(renameField("א"), { key: "Enter" });

        await waitFor(() =>
            expect(applyShuffles).toHaveBeenCalledWith(
                SID,
                [ "ג", "ב" ],
                undefined,
                { א: "ג" },
            ),
        );
    });

    it("refuses to rename onto another existing shuffle", () => {
        render(<ShufflesSection syllabusId={SID} />);

        startRename("א");
        fireEvent.change(renameField("א"), { target: { value: "ב" } });
        fireEvent.keyDown(renameField("א"), { key: "Enter" });

        expect(applyShuffles).not.toHaveBeenCalled();
        expect(enqueueSnackbar).toHaveBeenCalledWith(
            expect.stringMatching(/כבר קיים/),
            expect.anything(),
        );
    });

    it("regression: Escape or an unchanged name writes nothing", () => {
        render(<ShufflesSection syllabusId={SID} />);

        startRename("א");
        fireEvent.change(renameField("א"), { target: { value: "ג" } });
        fireEvent.keyDown(renameField("א"), { key: "Escape" });
        startRename("ב");
        fireEvent.keyDown(renameField("ב"), { key: "Enter" });

        expect(applyShuffles).not.toHaveBeenCalled();
        expect(updateSyllabus).not.toHaveBeenCalled();
    });
});

describe("ShufflesSection Hive link (#774)", () => {
    it("counts a shuffle linked to a differently-named group as in Hive", async () => {
        syllabus.shuffleHiveGroups = { א: 9 };
        apiGetClasses.mockResolvedValueOnce([
            { id: 9, name: "שם אחר", description: "", display_name: "שם אחר" },
        ]);
        render(<ShufflesSection syllabusId={SID} />);

        expect(await screen.findByText("Hive")).toBeTruthy();
        expect(screen.getAllByText("לא ב-Hive")).toHaveLength(1);
    });

    it("regression: a link to a group gone from Hive shows as missing", async () => {
        syllabus.shuffleHiveGroups = { א: 404 };
        apiGetClasses.mockResolvedValueOnce([
            { id: 1, name: "א", description: "", display_name: "א" },
        ]);
        render(<ShufflesSection syllabusId={SID} />);

        expect(await screen.findAllByText("לא ב-Hive")).toHaveLength(2);
    });

    it("offers a Hive group picker per shuffle once Hive loads", async () => {
        apiGetClasses.mockResolvedValueOnce([
            { id: 1, name: "א", description: "", display_name: "א" },
        ]);
        render(<ShufflesSection syllabusId={SID} />);

        expect(await screen.findByLabelText("קבוצת Hive של השאפל א")).toBeTruthy();
        expect(screen.getByLabelText("קבוצת Hive של השאפל ב")).toBeTruthy();
    });
});

describe("shuffleUsageLabel", () => {
    it("says a shuffle is unused instead of '0 פריטים'", () => {
        expect(shuffleUsageLabel(0)).toBe("לא בשימוש");
        expect(shuffleUsageLabel(1)).toBe("מערך/מופע אחד");
        expect(shuffleUsageLabel(3)).toBe("3 מערכים/מופעים");
    });
});
