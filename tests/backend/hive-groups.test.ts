import { describe, expect, it } from "vitest";

import { findCourseHiveGroup } from "@/api-shared/hive-groups";

const GROUPS = [
    { id: 11, name: "ניצה" },
    { id: 22, name: "לחם" },
];

describe("findCourseHiveGroup (#774)", () => {
    it("prefers the explicitly linked group over the same-named one", () => {
        expect(findCourseHiveGroup({ name: "ניצה", hiveClassId: 22 }, GROUPS)?.id).toBe(22);
    });

    it("links a renamed shuffle whose name no longer matches Hive", () => {
        expect(findCourseHiveGroup({ name: "שם חדש", hiveClassId: 11 }, GROUPS)?.id).toBe(11);
    });

    it("regression: an unlinked course still matches by exact name", () => {
        expect(findCourseHiveGroup({ name: "לחם" }, GROUPS)?.id).toBe(22);
        expect(findCourseHiveGroup({ name: "לחם", hiveClassId: null }, GROUPS)?.id).toBe(22);
    });

    it("falls back to the name when the linked group no longer exists", () => {
        expect(findCourseHiveGroup({ name: "ניצה", hiveClassId: 99 }, GROUPS)?.id).toBe(11);
    });

    it("returns undefined when nothing matches", () => {
        expect(findCourseHiveGroup({ name: "אין" }, GROUPS)).toBeUndefined();
    });
});
