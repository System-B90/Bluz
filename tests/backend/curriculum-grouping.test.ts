import dayjs from "dayjs";
import { describe, it, expect } from "vitest";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import {
    flattenCurriculumGroups,
    groupCurriculumsByStatus,
} from "@/components/gantt/curriculum-fab/utils";

function make(
    id: string,
    opts: { isDraft?: boolean; isArchived?: boolean; updatedAt?: string },
): GanttCurriculumDocument {
    return {
        id,
        title: id,
        description: "",
        startDate: null,
        syllabuses: [],
        weeks: [],
        isDraft: opts.isDraft ?? false,
        isArchived: opts.isArchived ?? false,
        createdAt: dayjs("2026-01-01"),
        updatedAt: dayjs(opts.updatedAt ?? "2026-01-01"),
    } as unknown as GanttCurriculumDocument;
}

function record(
    ...items: Array<GanttCurriculumDocument>
): Record<GanttCurriculumId, GanttCurriculumDocument> {
    return items.reduce(
        (acc, item) => {
            acc[item.id] = item;
            return acc;
        },
        {} as Record<GanttCurriculumId, GanttCurriculumDocument>,
    );
}

describe("groupCurriculumsByStatus", () => {
    it("splits into active, drafts and archived buckets", () => {
        const groups = groupCurriculumsByStatus(
            record(
                make("active1", {}),
                make("draft1", { isDraft: true }),
                make("archived1", { isArchived: true }),
            ),
        );

        expect(groups.active).toEqual(["active1"]);
        expect(groups.drafts).toEqual(["draft1"]);
        expect(groups.archived).toEqual(["archived1"]);
    });

    it("sorts each bucket by updatedAt descending", () => {
        const groups = groupCurriculumsByStatus(
            record(
                make("old", { updatedAt: "2026-01-01" }),
                make("new", { updatedAt: "2026-06-01" }),
                make("mid", { updatedAt: "2026-03-01" }),
            ),
        );

        expect(groups.active).toEqual(["new", "mid", "old"]);
    });

    it("treats an archived draft as archived (archived wins over draft)", () => {
        // Edge case from the spec: archives can still be drafts; such an item
        // must surface in the archive bucket, not the drafts bucket.
        const groups = groupCurriculumsByStatus(
            record(make("archivedDraft", { isDraft: true, isArchived: true })),
        );

        expect(groups.drafts).toEqual([]);
        expect(groups.archived).toEqual(["archivedDraft"]);
    });

    it("handles an empty set", () => {
        const groups = groupCurriculumsByStatus({});
        expect(groups).toEqual({ active: [], drafts: [], archived: [] });
    });
});

describe("flattenCurriculumGroups", () => {
    it("orders active → drafts → archived", () => {
        const groups = groupCurriculumsByStatus(
            record(
                make("archived1", { isArchived: true }),
                make("draft1", { isDraft: true }),
                make("active1", {}),
            ),
        );

        expect(flattenCurriculumGroups(groups)).toEqual([
            "active1",
            "draft1",
            "archived1",
        ]);
    });
});
