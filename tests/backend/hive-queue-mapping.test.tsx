// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
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

describe("HiveQueueMapping", () => {
    it("names the lesson and how many shuffles will get a queue", async () => {
        render(
            <HiveQueueMapping
                event={{ ...BASE_EVENT, hiveLesson: 500 }}
                onUpdate={vi.fn()}
            />,
        );

        await waitFor(() =>
            expect(
                screen.getByText(/שיעור בהייב: "תרגול רשתות"/),
            ).toBeTruthy(),
        );
        expect(screen.getByText(/ייפתח ל-2 שיבוצים/)).toBeTruthy();
    });

    it("says the lesson will be created when the event is not saved yet", async () => {
        render(<HiveQueueMapping event={BASE_EVENT} onUpdate={vi.fn()} />);

        await waitFor(() =>
            expect(screen.getByText(/שיעור בהייב ייווצר בשמירה/)).toBeTruthy(),
        );
    });

    it("warns plainly when no queue is mapped — nothing will open", async () => {
        render(
            <HiveQueueMapping
                event={{ ...BASE_EVENT, hiveQueues: {} }}
                onUpdate={vi.fn()}
            />,
        );

        await waitFor(() =>
            expect(
                screen.getByText(/לא ייווצר שיעור בהייב — לא נבחרו תורים/),
            ).toBeTruthy(),
        );
    });

    it("tells the user a module is required before queues can be picked", async () => {
        render(
            <HiveQueueMapping
                event={{ ...BASE_EVENT, hiveModule: 0, hiveQueues: {} }}
                onUpdate={vi.fn()}
            />,
        );

        await waitFor(() =>
            expect(screen.getByText(/בחרו מודול/)).toBeTruthy(),
        );
    });

    it("flags a shuffle that has no matching Hive student group", async () => {
        render(
            <HiveQueueMapping
                event={{
                    ...BASE_EVENT,
                    courses: ["c-nitza", "c-ghost"],
                    hiveQueues: { "c-ghost": 200, "c-nitza": 100 },
                }}
                onUpdate={vi.fn()}
            />,
        );

        await waitFor(() =>
            expect(screen.getByText("לא נמצא בהייב")).toBeTruthy(),
        );
    });

    it("shows each shuffle with the queue it will receive", async () => {
        render(
            <HiveQueueMapping
                event={{ ...BASE_EVENT, hiveLesson: 500 }}
                onUpdate={vi.fn()}
            />,
        );

        await waitFor(() => expect(apiGetQueues).toHaveBeenCalled());
        expect(screen.getByText("ניצה")).toBeTruthy();
        expect(screen.getByText("לחם")).toBeTruthy();
        await waitFor(() =>
            expect(screen.getByText("תור מתחילים")).toBeTruthy(),
        );
        expect(screen.getByText("תור מתקדמים")).toBeTruthy();
    });

    it("links into Hive by id for the module and each group", async () => {
        const { container } = render(
            <HiveQueueMapping
                event={{ ...BASE_EVENT, hiveLesson: 500 }}
                onUpdate={vi.fn()}
            />,
        );

        await waitFor(() => expect(apiGetClasses).toHaveBeenCalled());
        const hrefs = [...container.querySelectorAll("a")].map((a) =>
            a.getAttribute("href"),
        );

        expect(hrefs).toContain("https://hive.example/course/3/7");
        expect(hrefs).toContain("https://hive.example/mentor/classes?id=11");
        expect(hrefs).toContain("https://hive.example/mentor/classes?id=22");
    });

    it("stays out of the way for event types with no Hive subject", () => {
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
