// @vitest-environment jsdom

import { renderHook } from "@testing-library/react";
import type { Command } from "@system-b90/command-palette";
import { parseQuery, rankCommands } from "@system-b90/command-palette/core";
import { describe, expect, it, vi } from "vitest";

/** Timeline view words find the timeline tab from any gantt tab (#846). */

let registered: Array<Command> = [];
vi.mock("@system-b90/command-palette", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    useCommands: (commands: Array<Command>) => {
        registered = commands;
    },
}));

import { GANTT_TAB_INDEX } from "@/components/app-onboarding/gantt/tabs";
import { useGanttTabCommands } from "@/components/app-commands/use-gantt-tab-commands";

const noRecents = { boost: () => 0 } as unknown as Parameters<typeof rankCommands>[2]["recents"];

function search(text: string): Array<string> {
    return rankCommands(registered, parseQuery(text), { recents: noRecents }).map((r) => r.command.id);
}

describe("useGanttTabCommands", () => {
    it.each([ "משובצים", "לא משובצים", "אילוצים", "unallocated" ])("finds the timeline tab for %s on the weeks tab", (text) => {
        const setSelectedTabIndex = vi.fn();
        renderHook(() => useGanttTabCommands({ selectedTabIndex: GANTT_TAB_INDEX.weeks, setSelectedTabIndex }));
        const ids = search(text);
        expect(ids[0]).toBe("gantt.tab.timeline");

        registered.find((c) => c.id === "gantt.tab.timeline")?.run?.();
        expect(setSelectedTabIndex).toHaveBeenCalledWith(GANTT_TAB_INDEX.timeline);
    });
});
