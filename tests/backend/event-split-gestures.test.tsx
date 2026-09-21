// @vitest-environment jsdom
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Pointer-gesture wiring in `event-component/base.tsx`: the middle-click /
 * Shift+click split (#657) and the right-click context menu (#706).
 * Everything BluzEventComponent pulls in besides those gestures — theming,
 * subjects, custom colours, filters, locks, instructor-drop targets — is
 * mocked to its simplest working shape so the test exercises only
 * `handleClick`/`handleAuxClick`/`handleMouseDown`/`handleContextMenu`.
 */
const splitEventAt = vi.fn();
const openContextMenu = vi.fn();
// Swapped to null to stand in for a read-only iteration, which hands the tile
// no opener at all.
let contextMenuOpener: null | typeof openContextMenu = openContextMenu;
let selectedEventIds = new Set<string>();

vi.mock("@/components/base/HiveSubjectsProvider", () => ({
    useHiveSubjects: () => ({ getSubject: () => undefined }),
}));
vi.mock("@/components/base/CustomColorsProvider", () => ({
    useCustomColors: () => ({ getCustomColor: () => undefined }),
}));
vi.mock("@/components/base/CalendarFilterProvider", () => ({
    useCalendarFilters: () => ({ eventFilteredOpacity: () => 1 }),
}));
vi.mock(
    "@/components/schedule/calendar/calendar-provider/CalendarContext",
    () => ({ useCalendar: () => ({ eventLocks: {} }) }),
);
vi.mock(
    "@/components/schedule/calendar/instructor-dnd/use-event-drop-target",
    () => ({
        useEventDropTarget: () => ({
            setDropRef: () => undefined,
            isDropTarget: false,
            isOver: false,
        }),
    }),
);
vi.mock("@/components/schedule/event-component/utils", () => ({
    useElementSize: () => ({ ref: () => undefined, size: { width: 200, height: 40 } }),
}));
vi.mock("@/components/schedule/calendar/split/SplitCalendarContext", () => ({
    useSplitCalendar: () => ({
        hoveredEventId: null,
        selectedEventId: null,
        selectedEventIds,
        activeDrag: null,
        setHoveredEventId: () => undefined,
        splitEventAt,
        openContextMenu: contextMenuOpener,
    }),
}));

import { dayjs } from "@/api-shared/dayjs-setup";
import { BluzEventComponent } from "@/components/schedule/event-component/base";
import { EventSegment } from "@/components/schedule/calendar/split/segments";
import { Event } from "@/components/schedule/types/event";

const from = dayjs("2026-03-01T08:00:00.000Z");
const to = dayjs("2026-03-01T09:00:00.000Z");

function segmentFor(event: Event): EventSegment {
    return { key: `${event.id}#0`, event, from, to, index: 0, count: 1 };
}

const baseEvent = {
    id: "e1",
    name: "מופע",
    subject: 1,
    hiveModule: 1,
    startTime: from,
    endTime: to,
    type: "lecture",
    courses: [],
    rooms: [],
    instructors: [],
    tags: [],
    notes: "",
    locked: false,
    hidden: false,
    required: false,
    personalTalk: false,
    splitAcrossBreaks: false,
} as unknown as Event;

// Half-height rect: pointer at clientY 20 of a 0..40 box lands on the
// segment's midpoint, i.e. 08:30.
function renderTile(event: Event) {
    const result = render(
        <BluzEventComponent
            event={segmentFor(event)}
            title="מופע"
            continuesPrior={false}
            continuesAfter={false}
            isAllDay={false}
            localizer={undefined as never}
        />,
    );
    const tile = result.container.firstElementChild as HTMLElement;
    vi.spyOn(tile, "getBoundingClientRect").mockReturnValue({
        top: 0,
        bottom: 40,
        height: 40,
        left: 0,
        right: 200,
        width: 200,
        x: 0,
        y: 0,
        toJSON: () => undefined,
    });
    return { ...result, tile };
}

afterEach(() => {
    cleanup();
    splitEventAt.mockReset();
    openContextMenu.mockReset();
    contextMenuOpener = openContextMenu;
    selectedEventIds = new Set<string>();
});

describe("event tile split gestures (#657)", () => {
    it("shift+click splits at the clicked instant", () => {
        const { tile } = renderTile(baseEvent);

        fireEvent.click(tile, { shiftKey: true, clientY: 20 });

        expect(splitEventAt).toHaveBeenCalledTimes(1);
        const [ event, atMs ] = splitEventAt.mock.calls[ 0 ];
        expect(event).toBe(baseEvent);
        expect(atMs).toBe(dayjs("2026-03-01T08:30:00.000Z").valueOf());
    });

    it("a plain click (no shift) does not split", () => {
        const { tile } = renderTile(baseEvent);

        fireEvent.click(tile, { clientY: 20 });

        expect(splitEventAt).not.toHaveBeenCalled();
    });

    it("middle-click (auxclick) splits at the clicked instant", () => {
        const { tile } = renderTile(baseEvent);

        fireEvent(
            tile,
            new MouseEvent("auxclick", {
                bubbles: true,
                cancelable: true,
                button: 1,
                clientY: 20,
            }),
        );

        expect(splitEventAt).toHaveBeenCalledTimes(1);
        expect(splitEventAt.mock.calls[ 0 ][ 1 ]).toBe(
            dayjs("2026-03-01T08:30:00.000Z").valueOf(),
        );
    });

    it("a non-middle auxclick (e.g. right-click) does not split", () => {
        const { tile } = renderTile(baseEvent);

        fireEvent(
            tile,
            new MouseEvent("auxclick", {
                bubbles: true,
                cancelable: true,
                button: 2,
                clientY: 20,
            }),
        );

        expect(splitEventAt).not.toHaveBeenCalled();
    });

    it("prevents the browser's middle-click autoscroll on mousedown", () => {
        const { tile } = renderTile(baseEvent);

        const mousedown = new MouseEvent("mousedown", {
            bubbles: true,
            cancelable: true,
            button: 1,
        });
        tile.dispatchEvent(mousedown);

        expect(mousedown.defaultPrevented).toBe(true);
    });

    it("refuses to split a locked event via either gesture", () => {
        const locked = { ...baseEvent, locked: true } as Event;
        const { tile } = renderTile(locked);

        fireEvent.click(tile, { shiftKey: true, clientY: 20 });
        fireEvent(
            tile,
            new MouseEvent("auxclick", {
                bubbles: true,
                cancelable: true,
                button: 1,
                clientY: 20,
            }),
        );

        expect(splitEventAt).not.toHaveBeenCalled();
    });
});

describe("event tile right-click menu (#706)", () => {
    it("opens the menu at the pointer and suppresses the browser's own", () => {
        const { tile } = renderTile(baseEvent);

        const contextmenu = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
            clientX: 120,
            clientY: 240,
        });
        tile.dispatchEvent(contextmenu);

        expect(contextmenu.defaultPrevented).toBe(true);
        expect(openContextMenu).toHaveBeenCalledWith(baseEvent, 120, 240);
    });

    it("does not split — right-click is the menu gesture, not a cut", () => {
        const { tile } = renderTile(baseEvent);

        fireEvent.contextMenu(tile, { clientX: 10, clientY: 20 });

        expect(splitEventAt).not.toHaveBeenCalled();
    });

    it("opens for a locked event: the menu is how you unlock it", () => {
        const locked = { ...baseEvent, locked: true } as Event;
        const { tile } = renderTile(locked);

        fireEvent.contextMenu(tile, { clientX: 10, clientY: 20 });

        expect(openContextMenu).toHaveBeenCalledTimes(1);
    });

    it("leaves the native menu alone when the calendar is read-only", () => {
        // A past iteration hands the tile no opener, so the gesture must not
        // be swallowed — the browser's own menu stays available.
        contextMenuOpener = null;
        const { tile } = renderTile(baseEvent);

        const contextmenu = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: true,
        });
        tile.dispatchEvent(contextmenu);

        expect(contextmenu.defaultPrevented).toBe(false);
        expect(openContextMenu).not.toHaveBeenCalled();
    });
});
