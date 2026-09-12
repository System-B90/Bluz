// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The student board (#656). The security-relevant property is that everything
 * on screen is derived from the events already delivered — the board must
 * never ask the server for a list of classes, rooms or settings, because a
 * student is not allowed one.
 *
 * The rest is presentation: the room columns, the grid window, and what a tile
 * shows at each height.
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
import { BluzThemeProvider } from "@/components/theme/ThemeProvider";

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

function schedule(overrides: Record<string, unknown> = {}) {
    return {
        calendarDayEndTime: "22:00",
        calendarDayStartTime: "07:00",
        date: "2026-03-04",
        events: EVENTS,
        ...overrides,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    // next-themes reads the system colour scheme on mount; jsdom has no
    // `matchMedia`, and the board mounts the app's real theme provider.
    vi.stubGlobal(
        "matchMedia",
        vi.fn((query: string) => ({
            addEventListener: vi.fn(),
            addListener: vi.fn(),
            dispatchEvent: vi.fn(),
            matches: false,
            media: query,
            onchange: null,
            removeEventListener: vi.fn(),
            removeListener: vi.fn(),
        })),
    );
    // react-big-calendar and the tile measurement both want one; jsdom has
    // no implementation.
    vi.stubGlobal(
        "ResizeObserver",
        class {
            disconnect() {}
            observe() {}
            unobserve() {}
        },
    );
    vi.mocked(apiGetStudentSchedule).mockResolvedValue(schedule() as never);
});

afterEach(cleanup);

/** Renders inside the app's own theme, as the route does. */
function renderWithTheme(date = "2026-03-04") {
    return render(
        <BluzThemeProvider>
            <StudentDayBoard date={date} />
        </BluzThemeProvider>,
    );
}

/** Renders and waits for the first load to settle. */
async function renderBoard() {
    renderWithTheme();
    await waitFor(() => expect(screen.getByText("הרצאה בוקר")).toBeDefined());
}

/** Picks an option out of the group select. */
async function choose(label: string, option: string) {
    await userEvent.click(screen.getByLabelText(label));
    await userEvent.click(await screen.findByRole("option", { name: option }));
}

describe("StudentDayBoard filtering", () => {
    it("offers only the groups present in the delivered events", async () => {
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

    it("filters by group", async () => {
        await renderBoard();

        await choose("קבוצה", "מחזור ב");

        expect(screen.queryByText("הרצאה בוקר")).toBeNull();
        expect(screen.queryByText("תרגול ערב")).toBeNull();
        expect(screen.getByText("סדנת צהריים")).toBeDefined();
    });

    it("keeps the grid on screen when a filter matches nothing", async () => {
        vi.mocked(apiGetStudentSchedule).mockResolvedValue(
            schedule({ events: [EVENTS[0]] }) as never,
        );
        await renderBoard();

        await choose("קבוצה", "כל הקבוצות");

        // An empty result is an empty *calendar*, never a bare message: the
        // student should always see the day, not a dead end.
        expect(screen.getByTestId("student-board")).toBeDefined();
        expect(document.querySelector(".rbc-calendar")).not.toBeNull();
    });

    it("renders the grid for a day with no events at all", async () => {
        vi.mocked(apiGetStudentSchedule).mockResolvedValue(
            schedule({ events: [] }) as never,
        );

        renderWithTheme();

        await waitFor(() =>
            expect(document.querySelector(".rbc-calendar")).not.toBeNull(),
        );
        // Nothing to filter by, so no filter — but the day is still drawn.
        expect(screen.queryByLabelText("קבוצה")).toBeNull();
        expect(screen.queryByText("אין אירועים ליום זה")).toBeNull();
    });
});

describe("StudentDayBoard room columns", () => {
    it("renders one column per room, Hebrew-sorted", async () => {
        await renderBoard();

        const headers = [
            ...document.querySelectorAll(".rbc-row-resource .rbc-header"),
        ].map((header) => header.textContent);

        expect(headers).toEqual(["כיתה 1", "כיתה 2"]);
    });

    it("repeats an event across every room it occupies", async () => {
        vi.mocked(apiGetStudentSchedule).mockResolvedValue(
            schedule({
                events: [{ ...EVENTS[0], rooms: ["כיתה 1", "כיתה 2"] }],
            }) as never,
        );

        renderWithTheme();

        await waitFor(() =>
            expect(screen.getAllByText("הרצאה בוקר")).toHaveLength(2),
        );
    });

    it("files a roomless event under the no-room column", async () => {
        vi.mocked(apiGetStudentSchedule).mockResolvedValue(
            schedule({ events: [{ ...EVENTS[0], rooms: [] }] }) as never,
        );

        renderWithTheme();

        await waitFor(() => expect(screen.getByText("הרצאה בוקר")).toBeDefined());
        expect(screen.getByText("ללא כיתה")).toBeDefined();
    });
});

describe("StudentDayBoard grid window", () => {
    it("uses the calendar hours the server sent, not a bare 24h day", async () => {
        vi.mocked(apiGetStudentSchedule).mockResolvedValue(
            schedule({
                calendarDayEndTime: "20:00",
                calendarDayStartTime: "08:00",
            }) as never,
        );

        renderWithTheme();

        await waitFor(() => expect(screen.getByText("הרצאה בוקר")).toBeDefined());
        const gutter = [
            ...document.querySelectorAll(".rbc-time-gutter .rbc-label"),
        ].map((label) => label.textContent);

        expect(gutter[0]).toBe("08:00");
        expect(gutter).not.toContain("00:00");
        expect(gutter).not.toContain("21:00");
    });

    it("falls back to the default window when the response omits the hours", async () => {
        vi.mocked(apiGetStudentSchedule).mockResolvedValue({
            date: "2026-03-04",
            events: EVENTS,
        } as never);

        renderWithTheme();

        await waitFor(() => expect(screen.getByText("הרצאה בוקר")).toBeDefined());
        const gutter = [
            ...document.querySelectorAll(".rbc-time-gutter .rbc-label"),
        ].map((label) => label.textContent);

        expect(gutter[0]).toBe("07:00");
    });
});

describe("StudentDayBoard tiles", () => {
    it("shows the name, the time range and the event's groups", async () => {
        await renderBoard();

        const tile = screen.getByText("הרצאה בוקר").closest(".rbc-event");
        expect(tile).not.toBeNull();
        // 06:00Z–07:00Z in Asia/Jerusalem (UTC+2 in March).
        expect(within(tile as HTMLElement).getByText("08:00–09:00")).toBeDefined();
        expect(within(tile as HTMLElement).getByText("מחזור א")).toBeDefined();
    });

    it("paints readable text over the event's own colour", async () => {
        vi.mocked(apiGetStudentSchedule).mockResolvedValue(
            schedule({ events: [{ ...EVENTS[0], color: "#000000" }] }) as never,
        );

        renderWithTheme();

        await waitFor(() => expect(screen.getByText("הרצאה בוקר")).toBeDefined());
        const tile = screen
            .getByText("הרצאה בוקר")
            .closest(".rbc-event") as HTMLElement;

        // Black tile, so the contrast text must not be black as well — that
        // combination is what made titles look empty.
        expect(tile.style.backgroundColor).toBe("rgb(0, 0, 0)");
        expect(tile.style.color).toBe("rgb(255, 255, 255)");
    });

    it("anchors the tile to RTL with an attribute, not a style", async () => {
        await renderBoard();

        const tile = screen
            .getByText("הרצאה בוקר")
            .closest(".rbc-event") as HTMLElement;

        // The emotion RTL plugin flips a `direction` declaration in `sx`, so
        // the attribute is the only thing that survives.
        expect(tile.querySelector("[dir='rtl']")).not.toBeNull();
        // The range itself stays LTR inside the RTL line.
        expect(tile.querySelector("bdi[dir='ltr']")).not.toBeNull();
    });
});

describe("StudentDayBoard chrome", () => {
    it("shows a skeleton while the first load is in flight", async () => {
        let release: (value: unknown) => void = () => {};
        vi.mocked(apiGetStudentSchedule).mockReturnValue(
            new Promise((resolve) => {
                release = resolve;
            }) as never,
        );

        renderWithTheme();

        expect(screen.getByLabelText("טוען לוח זמנים")).toBeDefined();
        release(schedule());
        await waitFor(() => expect(screen.getByText("הרצאה בוקר")).toBeDefined());
    });

    it("carries the theme toggle, so the board has light and dark", async () => {
        await renderBoard();

        expect(screen.getByLabelText("החלפת ערכת נושא")).toBeDefined();
    });

    it("takes over the viewport in fullscreen, and leaves on Escape", async () => {
        await renderBoard();

        await userEvent.click(screen.getByLabelText("מסך מלא"));
        const exit = screen.getByLabelText("צא ממסך מלא (Esc)");
        expect(exit).toBeDefined();

        await userEvent.keyboard("{Escape}");
        await waitFor(() =>
            expect(screen.queryByLabelText("צא ממסך מלא (Esc)")).toBeNull(),
        );
    });

    it("reports an unreachable schedule endpoint without leaking the reason", async () => {
        vi.mocked(apiGetStudentSchedule).mockRejectedValue(
            new Error("mongodb://secret-host:27017 refused"),
        );

        renderWithTheme();

        await waitFor(() =>
            expect(screen.getByText("לא ניתן לטעון את הלוח כרגע")).toBeDefined(),
        );
        expect(document.body.textContent).not.toContain("secret-host");
    });
});
