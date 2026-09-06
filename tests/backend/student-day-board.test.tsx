// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The student board's filtering (#656). The security-relevant property is that
 * the filter options are derived from the events already delivered — the board
 * must never ask the server for a list of classes or rooms, because a student
 * is not allowed one.
 */

vi.mock("@/api-client/student-view", () => ({
    apiGetStudentSchedule: vi.fn(),
}));
vi.mock("@/components/student-view/use-foreground-timer", () => ({
    useForegroundTimer: vi.fn(),
}));
// Covered on its own in `student-live-refresh.test.tsx`; stubbed here so the
// board test does not open a socket.
vi.mock("@/components/student-view/use-student-live-refresh", () => ({
    useStudentLiveRefresh: vi.fn(),
}));

import { apiGetStudentSchedule } from "@/api-client/student-view";
import { StudentDayBoard } from "@/components/student-view/StudentDayBoard";

const EVENTS = [
    {
        color: "#111111",
        courses: ["מחזור א"],
        endTime: "2026-03-04T07:00:00.000Z",
        id: "e1",
        name: "הרצאה בוקר",
        rooms: ["כיתה 1"],
        startTime: "2026-03-04T06:00:00.000Z",
    },
    {
        color: "#222222",
        courses: ["מחזור ב"],
        endTime: "2026-03-04T09:00:00.000Z",
        id: "e2",
        name: "סדנת צהריים",
        rooms: ["כיתה 2"],
        startTime: "2026-03-04T08:00:00.000Z",
    },
    {
        color: "#333333",
        courses: ["מחזור א"],
        endTime: "2026-03-04T11:00:00.000Z",
        id: "e3",
        name: "תרגול ערב",
        rooms: ["כיתה 2"],
        startTime: "2026-03-04T10:00:00.000Z",
    },
];

beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiGetStudentSchedule).mockResolvedValue({
        date: "2026-03-04",
        events: EVENTS,
    });
});

afterEach(cleanup);

/** Renders and waits for the first load to settle. */
async function renderBoard() {
    render(<StudentDayBoard date="2026-03-04" />);
    await waitFor(() => expect(screen.getByText("הרצאה בוקר")).toBeDefined());
}

/** Picks an option out of one of the two MUI selects. */
async function choose(label: string, option: string) {
    await userEvent.click(screen.getByLabelText(label));
    await userEvent.click(await screen.findByRole("option", { name: option }));
}

describe("StudentDayBoard filtering", () => {
    it("offers only the classes and rooms present in the delivered events", async () => {
        await renderBoard();

        await userEvent.click(screen.getByLabelText("קבוצה"));
        const courseOptions = screen
            .getAllByRole("option")
            .map((option) => option.textContent);

        // "All" plus exactly the two distinct course names — deduped, and
        // nothing that was not already on screen.
        expect(courseOptions).toEqual(["כל הקבוצות", "מחזור א", "מחזור ב"]);
        expect(apiGetStudentSchedule).toHaveBeenCalledTimes(1);
    });

    it("filters by class", async () => {
        await renderBoard();

        await choose("קבוצה", "מחזור ב");

        expect(screen.queryByText("הרצאה בוקר")).toBeNull();
        expect(screen.queryByText("תרגול ערב")).toBeNull();
        expect(screen.getByText("סדנת צהריים")).toBeDefined();
    });

    it("filters by room", async () => {
        await renderBoard();

        await choose("חדר", "כיתה 2");

        expect(screen.queryByText("הרצאה בוקר")).toBeNull();
        expect(screen.getByText("סדנת צהריים")).toBeDefined();
        expect(screen.getByText("תרגול ערב")).toBeDefined();
    });

    it("combines the two filters", async () => {
        await renderBoard();

        await choose("קבוצה", "מחזור א");
        await choose("חדר", "כיתה 2");

        expect(screen.getByText("תרגול ערב")).toBeDefined();
        expect(screen.queryByText("הרצאה בוקר")).toBeNull();
        expect(screen.queryByText("סדנת צהריים")).toBeNull();
    });

    it("says so when a filter matches nothing, rather than looking empty", async () => {
        await renderBoard();

        await choose("קבוצה", "מחזור ב");
        await choose("חדר", "כיתה 1");

        expect(screen.getByText("אין אירועים התואמים לסינון")).toBeDefined();
    });

    it("does not filter the board when the API returns nothing", async () => {
        vi.mocked(apiGetStudentSchedule).mockResolvedValue({
            date: "2026-03-04",
            events: [],
        });

        render(<StudentDayBoard date="2026-03-04" />);

        await waitFor(() =>
            expect(screen.getByText("אין אירועים ליום זה")).toBeDefined(),
        );
        expect(screen.queryByLabelText("קבוצה")).toBeNull();
    });
});
