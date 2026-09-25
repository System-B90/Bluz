// @vitest-environment jsdom

import {
    act,
    cleanup,
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The event dialog must state the Hive side outright: whether a lesson backs
 * this event, which queue each shuffle gets, and when a shuffle has no Hive
 * group at all. Staff scheduling a day must not have to guess what students
 * will be handed.
 */

const { apiGetClasses, apiGetQueues } = vi.hoisted(() => ({
    apiGetClasses: vi.fn(async () => [
        { id: 11, name: "ניצה" },
        { id: 22, name: "לחם" },
    ]),
    apiGetQueues: vi.fn(async () => [
        { id: 100, name: "תור מתחילים" },
        { id: 200, name: "תור מתקדמים" },
    ]),
}));

vi.mock("@/api-client/hive", () => ({ apiGetClasses, apiGetQueues }));
vi.mock("@/components/base/CoursesProvider", () => ({
    useCourses: () => ({
        getCourse: (id: string) =>
            ({
                "c-ghost": { id: "c-ghost", name: "רוח" },
                "c-lechem": { id: "c-lechem", name: "לחם" },
                "c-nitza": { id: "c-nitza", name: "ניצה" },
            })[id],
    }),
}));
vi.mock("@/components/base/HiveLessonsProvider", () => ({
    useHiveLessons: () => ({
        getLesson: (id: number) =>
            id === 500 ? { id: 500, name: "תרגול רשתות" } : undefined,
    }),
}));
vi.mock("@/components/base/IterationProvider", () => ({
    useIterationScope: () => ({
        iterationId: undefined,
        currentIterationId: undefined,
        iterations: [],
    }),
    useActiveIterationHiveUrl: () => undefined,
}));

import { EventType } from "@/api-shared/types/event";
import { HiveQueueMapping } from "@/components/schedule/event-dialog/HiveQueueMapping";

const BASE_EVENT = {
    courses: ["c-nitza", "c-lechem"],
    hiveModule: 7,
    hiveQueues: { "c-lechem": 200, "c-nitza": 100 },
    subject: 3,
    type: EventType.EXERCISE,
};

beforeEach(() => {
    process.env.NEXT_PUBLIC_HIVE_URL = "https://hive.example";
    vi.clearAllMocks();
});

afterEach(cleanup);

/**
 * The card ships collapsed — the Hive side is a check, not the main edit — so
 * every assertion about its body has to open it first.
 */
function renderExpanded(
    event: Partial<Parameters<typeof HiveQueueMapping>[0]["event"]>,
) {
    const utils = render(<HiveQueueMapping event={event} onUpdate={vi.fn()} />);
    fireEvent.click(screen.getByText("תורים בהייב לפי שיבוץ"));
    return utils;
}

describe("HiveQueueMapping", () => {
    it("starts collapsed, summarising the mapping in one chip", async () => {
        render(<HiveQueueMapping event={BASE_EVENT} onUpdate={vi.fn()} />);

        expect(screen.getByText("2/2 תורים")).toBeTruthy();
        expect(screen.queryByText(/שיעור בהייב/)).toBeNull();

        fireEvent.click(screen.getByText("תורים בהייב לפי שיבוץ"));
        await waitFor(() =>
            expect(screen.getByText(/שיעור בהייב/)).toBeTruthy(),
        );
        expect(screen.queryByText("2/2 תורים")).toBeNull();
    });

    it("names the lesson and how many shuffles will get a queue", async () => {
        renderExpanded({ ...BASE_EVENT, hiveLesson: 500 });

        await waitFor(() =>
            expect(screen.getByText(/שיעור בהייב: "תרגול רשתות"/)).toBeTruthy(),
        );
        expect(screen.getByText(/ייפתח ל-2 שיבוצים/)).toBeTruthy();
    });

    it("says the lesson will be created when the event is not saved yet", async () => {
        renderExpanded(BASE_EVENT);

        await waitFor(() =>
            expect(screen.getByText(/שיעור בהייב ייווצר בשמירה/)).toBeTruthy(),
        );
    });

    it("warns plainly when no queue is mapped — nothing will open", async () => {
        renderExpanded({ ...BASE_EVENT, hiveQueues: {} });

        await waitFor(() =>
            expect(
                screen.getByText(/לא ייווצר שיעור בהייב — לא נבחרו תורים/),
            ).toBeTruthy(),
        );
    });

    it("tells the user a module is required before queues can be picked", async () => {
        renderExpanded({ ...BASE_EVENT, hiveModule: 0, hiveQueues: {} });

        await waitFor(() =>
            expect(screen.getByText(/בחרו מודול/)).toBeTruthy(),
        );
    });

    it("flags a shuffle that has no matching Hive student group", async () => {
        renderExpanded({
            ...BASE_EVENT,
            courses: ["c-nitza", "c-ghost"],
            hiveQueues: { "c-ghost": 200, "c-nitza": 100 },
        });

        await waitFor(() =>
            expect(screen.getByText("לא נמצא בהייב")).toBeTruthy(),
        );
    });

    it("shows each shuffle with the queue it will receive", async () => {
        renderExpanded({ ...BASE_EVENT, hiveLesson: 500 });

        await waitFor(() => expect(apiGetQueues).toHaveBeenCalled());
        expect(screen.getByText("ניצה")).toBeTruthy();
        expect(screen.getByText("לחם")).toBeTruthy();
        await waitFor(() =>
            expect(screen.getByText("תור מתחילים")).toBeTruthy(),
        );
        expect(screen.getByText("תור מתקדמים")).toBeTruthy();
    });

    it("links into Hive by id for the module and each group", async () => {
        const { container } = renderExpanded({
            ...BASE_EVENT,
            hiveLesson: 500,
        });

        await waitFor(() => expect(apiGetClasses).toHaveBeenCalled());
        const hrefs = [...container.querySelectorAll("a")].map((a) =>
            a.getAttribute("href"),
        );

        expect(hrefs).toContain("https://hive.example/course/3/7");
        expect(hrefs).toContain("https://hive.example/mentor/classes?id=11");
        expect(hrefs).toContain("https://hive.example/mentor/classes?id=22");
    });

    it("counts a queue with id 0 as mapped (#622)", () => {
        // Queue id 0 is a real id. A truthiness check reported "1/2 תורים"
        // and silently dropped the mapping on the next write.
        render(
            <HiveQueueMapping
                event={{
                    ...BASE_EVENT,
                    hiveQueues: { "c-lechem": 0, "c-nitza": 100 },
                }}
                onUpdate={vi.fn()}
            />,
        );

        expect(screen.getByText("2/2 תורים")).toBeTruthy();
    });

    it("keeps queue id 0 when it is picked, rather than unsetting (#622)", async () => {
        const onUpdate = vi.fn();
        apiGetQueues.mockResolvedValueOnce([
            { id: 0, name: "תור ברירת מחדל" },
            { id: 100, name: "תור מתחילים" },
        ]);
        render(<HiveQueueMapping event={BASE_EVENT} onUpdate={onUpdate} />);
        fireEvent.click(screen.getByText("תורים בהייב לפי שיבוץ"));

        await waitFor(() => expect(apiGetQueues).toHaveBeenCalled());
        const [ select ] = screen.getAllByRole("combobox");
        fireEvent.mouseDown(select);
        fireEvent.click(await screen.findByText("תור ברירת מחדל"));

        expect(onUpdate).toHaveBeenCalledWith({
            hiveQueues: expect.objectContaining({ "c-nitza": 0 }),
        });
    });

    it("ignores a stale classes response that lands after a newer one (#621)", async () => {
        // The first fetch is still in flight when the card is switched off and
        // back on ("פיקטיבי"), which starts a second fetch.
        let resolveStale: (rows: Array<unknown>) => void = () => {};
        apiGetClasses.mockReturnValueOnce(
            new Promise((resolve) => {
                resolveStale = resolve;
            }),
        );

        const event = { ...BASE_EVENT, courses: ["c-nitza", "c-lechem"] };
        const { rerender } = render(
            <HiveQueueMapping event={event} onUpdate={vi.fn()} />,
        );
        rerender(
            <HiveQueueMapping
                event={{ ...event, fake: true }}
                onUpdate={vi.fn()}
            />,
        );
        rerender(<HiveQueueMapping event={event} onUpdate={vi.fn()} />);
        fireEvent.click(screen.getByText("תורים בהייב לפי שיבוץ"));

        // The newer fetch resolves first and matches both shuffles.
        await waitFor(() => expect(apiGetClasses).toHaveBeenCalledTimes(2));
        await waitFor(() =>
            expect(screen.queryByText("לא נמצא בהייב")).toBeNull(),
        );

        // The stale one lands last, knowing about neither shuffle. Unguarded,
        // it overwrote the newer answer and flagged both as missing.
        await act(async () => {
            resolveStale([]);
        });

        expect(screen.queryAllByText("לא נמצא בהייב")).toHaveLength(0);
    });

    it("stays out of the way for event types with no Hive subject", () => {
        // Nothing renders at all here, so there is no header to expand.
        const { container } = render(
            <HiveQueueMapping
                event={{ ...BASE_EVENT, type: EventType.PRAYER }}
                onUpdate={vi.fn()}
            />,
        );

        expect(container.firstChild).toBeNull();
        expect(apiGetQueues).not.toHaveBeenCalled();
    });
});
