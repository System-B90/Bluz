// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { isValidElement, ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The ✕ beside the course start date is named and undoable (#843). */

const updateCurriculum = vi.fn();
const enqueueSnackbar = vi.fn();
const closeSnackbar = vi.fn();

vi.mock("notistack", () => ({ useSnackbar: () => ({ enqueueSnackbar, closeSnackbar }) }));
vi.mock("@/components/gantt/state/hooks/gantt-funcs/UseCurriculumActions", () => ({
    useCurriculumActions: () => ({ updateCurriculum }),
}));

import { GanttCurriculum, GanttCurriculumId } from "@/api-shared/types/gantt/models";
import {
    CLEAR_START_DATE_LABEL,
    CourseStartDateControl,
    START_DATE_CLEARED_MESSAGE,
} from "@/components/gantt/curriculum-view/tabs/weeks-tab/CourseStartDateControl";

const CID = "c1" as GanttCurriculumId;
const curriculum = { id: CID, startDate: "2026-08-02", weeks: [] } as unknown as GanttCurriculum;

function renderControl() {
    render(
        <LocalizationProvider dateAdapter={AdapterDayjs}>
            <CourseStartDateControl curriculum={curriculum} curriculumId={CID} />
        </LocalizationProvider>,
    );
    return screen.getByRole("button", { name: CLEAR_START_DATE_LABEL });
}

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

describe("CourseStartDateControl clear (#843)", () => {
    it("has an accessible name", () => {
        expect(renderControl()).toBeTruthy();
    });

    it("offers an undo that restores the previous date", async () => {
        updateCurriculum.mockResolvedValue({});
        fireEvent.click(renderControl());
        await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(START_DATE_CLEARED_MESSAGE, expect.anything()));
        expect(updateCurriculum).toHaveBeenCalledWith(CID, { startDate: null });

        const action = enqueueSnackbar.mock.calls[0][1].action as (key: string) => ReactElement;
        const undo = action("k1");
        expect(isValidElement(undo)).toBe(true);
        render(undo);
        fireEvent.click(screen.getByRole("button", { name: "ביטול" }));
        expect(closeSnackbar).toHaveBeenCalledWith("k1");
        expect(updateCurriculum).toHaveBeenLastCalledWith(CID, { startDate: "2026-08-02" });
    });

    it("offers no undo when the clear failed", async () => {
        updateCurriculum.mockRejectedValue(new Error("boom"));
        fireEvent.click(renderControl());
        await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalled());
        expect(enqueueSnackbar).not.toHaveBeenCalledWith(START_DATE_CLEARED_MESSAGE, expect.anything());
    });
});
