// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Timeline view choices survive a reload (#821): each is written to
 * localStorage and read back by a fresh module instance (a new page load).
 */

const MODULE = "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/timeline-preferences";

async function freshLoad() {
    vi.resetModules();
    return import(MODULE);
}

beforeEach(() => {
    window.localStorage.clear();
});

describe("timeline preferences (#821)", () => {
    it("defaults to weekly view, constraints on, everything else off", async () => {
        const prefs = await freshLoad();
        expect(prefs.timelineWeeklyView.get()).toBe(true);
        expect(prefs.timelineShowConstraints.get()).toBe(true);
        expect(prefs.timelineShowUnallocated.get()).toBe(false);
        expect(prefs.timelineIgnoreBreaks.get()).toBe(false);
        expect(prefs.timelineRelativeDaySizing.get()).toBe(false);
    });

    it("keeps every choice after a reload", async () => {
        const before = await freshLoad();
        before.timelineWeeklyView.set(false);
        before.timelineShowConstraints.set(false);
        before.timelineShowUnallocated.set(true);
        before.timelineIgnoreBreaks.set(true);
        before.timelineRelativeDaySizing.set(true);

        const after = await freshLoad();
        expect(after.timelineWeeklyView.get()).toBe(false);
        expect(after.timelineShowConstraints.get()).toBe(false);
        expect(after.timelineShowUnallocated.get()).toBe(true);
        expect(after.timelineIgnoreBreaks.get()).toBe(true);
        expect(after.timelineRelativeDaySizing.get()).toBe(true);
    });

    it("does not share the table tab's ignore-breaks flag", async () => {
        const prefs = await freshLoad();
        prefs.timelineIgnoreBreaks.set(true);
        expect(window.localStorage.getItem("bluz.gridIgnoreBreaks")).toBeNull();
    });
});
