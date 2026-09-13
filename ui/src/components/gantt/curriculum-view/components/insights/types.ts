import { Dayjs } from "dayjs";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { NormalizedStore } from "@/api-client/gantt/drizzle-normalize";
import { GanttDayIndex } from "@/api-shared/types/gantt/models";

/** Drives the card accent colour and the rotation order (warnings first). */
export type InsightSeverity = "fun" | "info" | "success" | "warning";

/** Drives the card's header icon. */
export type InsightCategory = "content" | "fun" | "people" | "schedule" | "structure";

/**
 * A visual is plain data so generators stay pure `.ts` functions; the card maps
 * each `kind` to its renderer.
 */
export type InsightVisual =
    | {
        kind: "bars";
        bars: Array<{ label: string; value: number; max: number; highlight?: boolean }>;
    }
    | {
        kind: "bigNumber";
        value: string;
        caption: string;
    }
    | {
        kind: "chips";
        chips: Array<{ label: string; count?: number }>;
    }
    | {
        kind: "donut";
        slices: Array<{ label: string; value: number }>;
        centerLabel: string;
    }
    | {
        kind: "leaderboard";
        rows: Array<{ label: string; value: number; valueLabel: string }>;
    }
    | {
        kind: "ring";
        value: number;
        max: number;
        label: string;
    }
    | {
        kind: "timeline";
        startLabel: string;
        endLabel: string;
        /** 0..1 position of "today", or null when outside the course. */
        progress: null | number;
    }
    | {
        kind: "weekdayHeatmap";
        cells: Array<{ label: string; value: number }>;
    };

export type Insight = {
    id: string;
    category: InsightCategory;
    severity: InsightSeverity;
    title: string;
    body: string;
    visual?: InsightVisual;
};

export type InsightGenerator = (ctx: InsightContext) => Insight | null;

export type InsightDay = {
    id: string;
    dayIndex: GanttDayIndex;
    weekNumber: number;
    capacityMinutes: number;
    scheduledMinutes: number;
    date: Dayjs | null;
};

export type InsightWeek = {
    id: string;
    number: number;
    weekendDuty: boolean;
    capacityMinutes: number;
    scheduledMinutes: number;
    days: Array<InsightDay>;
};

export type InsightEvent = {
    id: string;
    event: NormalizedStore["events"][string];
    moduleTitle: string;
    syllabusTitle: string;
    isBreak: boolean;
    /** Placed on the timeline, either itself or through a whole-module mapping. */
    isPlaced: boolean;
    occurrences: number;
    /** minimumDuration × occurrences. */
    totalMinutes: number;
};

/** Everything a generator needs, derived once per state change. */
export type InsightContext = {
    curriculum: GanttCurriculumDocument;
    state: NormalizedStore;
    weeks: Array<InsightWeek>;
    days: Array<InsightDay>;
    events: Array<InsightEvent>;
    /** Events outside the meal-breaks syllabus. */
    workEvents: Array<InsightEvent>;
    capacityMinutes: number;
    scheduledMinutes: number;
    requiredMinutes: number;
    now: Dayjs;
    instructorName: (id: number) => string;
    outsiderName: (id: string) => string | undefined;
};
