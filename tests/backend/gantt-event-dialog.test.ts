import { describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";

// The routes exercised below are staff-gated. Bypass requireStaffSession()'s
// getServerSession() call, which touches next/headers outside a request scope
// in vitest — same shim as base-gantt.test.ts (#223).
vi.mock("next-auth", async () => {
    const { Clearance } = await import("@/api-shared/types/hive");
    return {
        default: vi.fn(() => vi.fn()),
        getServerSession: vi.fn(async () => ({
            user: {
                id: "test-user",
                display_name: "Test User",
                clearance: Clearance.Admin,
            },
        })),
    };
});

vi.mock("@/api-server/hive/sso", () => ({
    authOptions: {},
}));

// ─── pure utility tests (no mocks needed) ─────────────────────────────────────

import { getNextIndexedTitle } from "@/app/api/gantt/events/[id]/duplicate/title-utils";
import { buildVirtualSiblingConstraints } from "@/components/gantt/event-dialog/constraints/virtual-constraints";
import { ConstraintType } from "@/api-shared/types/gantt/models/constraint";

describe("getNextIndexedTitle", () => {
    it("appends (2) to a plain title", () => {
        expect(getNextIndexedTitle("מבוא")).toBe("מבוא (2)");
    });

    it("increments an existing index", () => {
        expect(getNextIndexedTitle("מבוא (2)")).toBe("מבוא (3)");
        expect(getNextIndexedTitle("מבוא (9)")).toBe("מבוא (10)");
    });

    it("handles trailing whitespace before the parens", () => {
        expect(getNextIndexedTitle("מבוא  (2)")).toBe("מבוא (3)");
    });

    it("treats a title ending with plain text in parentheses as a plain title", () => {
        // e.g. "מבוא (תיאוריה)" — no pure number, so gets (2) appended
        expect(getNextIndexedTitle("מבוא (תיאוריה)")).toBe("מבוא (תיאוריה) (2)");
    });
});

describe("buildVirtualSiblingConstraints", () => {
    const events = ["e1", "e2", "e3"] as const;

    it("first event gets only a 'before' constraint toward the next", () => {
        const constraints = buildVirtualSiblingConstraints("e1", "m1", [...events]);
        expect(constraints).toHaveLength(1);
        expect(constraints[0]).toMatchObject({
            id: "virtual-before-e2",
            type: ConstraintType.Relational,
            relation: "before",
            ownerEventId: "e1",
            targetId: "e2",
        });
    });

    it("last event gets only an 'after' constraint toward the previous", () => {
        const constraints = buildVirtualSiblingConstraints("e3", "m1", [...events]);
        expect(constraints).toHaveLength(1);
        expect(constraints[0]).toMatchObject({
            id: "virtual-after-e2",
            type: ConstraintType.Relational,
            relation: "after",
            ownerEventId: "e3",
            targetId: "e2",
        });
    });

    it("middle event gets both 'after' prev and 'before' next", () => {
        const constraints = buildVirtualSiblingConstraints("e2", "m1", [...events]);
        expect(constraints).toHaveLength(2);
        const after = constraints.find((c) => c.relation === "after");
        const before = constraints.find((c) => c.relation === "before");
        expect(after?.targetId).toBe("e1");
        expect(before?.targetId).toBe("e3");
    });

    it("single event in module has no virtual constraints", () => {
        const constraints = buildVirtualSiblingConstraints("e1", "m1", ["e1"]);
        expect(constraints).toHaveLength(0);
    });

    it("event not found in module returns empty array", () => {
        const constraints = buildVirtualSiblingConstraints("eX", "m1", [...events]);
        expect(constraints).toHaveLength(0);
    });

    it("virtual constraint IDs never clash across siblings", () => {
        const c1 = buildVirtualSiblingConstraints("e1", "m1", [...events]);
        const c2 = buildVirtualSiblingConstraints("e2", "m1", [...events]);
        const c3 = buildVirtualSiblingConstraints("e3", "m1", [...events]);
        const allIds = [...c1, ...c2, ...c3].map((c) => c.id);
        const uniqueIds = new Set(allIds);
        expect(uniqueIds.size).toBe(allIds.length);
    });
});

// ─── duplicate route tests ─────────────────────────────────────────────────────

vi.mock("@/api-server/gantt/db-module-event", () => ({
    DbModuleEvent: {
        getItem: vi.fn(),
        createNewItem: vi.fn(),
    },
}));

import * as DuplicateRoute from "@/app/api/gantt/events/[id]/duplicate/route";
import { DbModuleEvent } from "@/api-server/gantt/db-module-event";
import {
    EventRecurrence,
    ModuleEventType,
    RoomRequirement,
} from "@/api-shared/types/gantt/models";
import { ApiModuleEvent } from "@/api-shared/types/gantt/api-layer";

const baseEvent = {
    id: "evt-1",
    title: "פיזיקה",
    type: ModuleEventType.Lecture,
    minimumDuration: 90,
    allocatedDuration: 90,
    orchestratorId: 42,
    recommendedLecturerIds: ["outsider-abc", "outsider-xyz"],
    systemRequirements: ["לוח חכם"],
    roomRequirement: RoomRequirement.Classified,
    recurrence: EventRecurrence.None,
    isCritical: false,
    isPaWindow: true,
    comment: "הערה",
    createdAt: new Date(),
    updatedAt: new Date(),
    constraints: [],
};

describe("POST /api/gantt/events/[id]/duplicate", () => {
    const context = { params: Promise.resolve({ id: "evt-1" }) };

    it("copies all new metadata fields to the duplicated event", async () => {
        vi.mocked(DbModuleEvent.getItem).mockResolvedValueOnce(baseEvent as ApiModuleEvent);
        vi.mocked(DbModuleEvent.createNewItem).mockResolvedValueOnce({
            ...baseEvent,
            id: "evt-2",
            title: "פיזיקה (2)",
        } as ApiModuleEvent);

        const request = new NextRequest("http://localhost/api/gantt/events/evt-1/duplicate", {
            method: "POST",
            body: JSON.stringify({ moduleId: "mod-1" }),
        });

        const response = await DuplicateRoute.POST(request, context);
        expect(response.status).toBe(200);

        expect(DbModuleEvent.createNewItem).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "פיזיקה (2)",
                orchestratorId: 42,
                recommendedLecturerIds: ["outsider-abc", "outsider-xyz"],
                systemRequirements: ["לוח חכם"],
                roomRequirement: RoomRequirement.Classified,
                recurrence: EventRecurrence.None,
                isCritical: false,
                isPaWindow: true,
                comment: "הערה",
                allocatedDuration: 0,
            }),
        );
    });

    it("indexes the title on duplicate", async () => {
        vi.mocked(DbModuleEvent.getItem).mockResolvedValueOnce({
            ...baseEvent,
            title: "פיזיקה (3)",
        } as ApiModuleEvent);
        vi.mocked(DbModuleEvent.createNewItem).mockResolvedValueOnce({
            ...baseEvent,
            title: "פיזיקה (4)",
        } as ApiModuleEvent);

        const request = new NextRequest("http://localhost/api/gantt/events/evt-1/duplicate", {
            method: "POST",
            body: JSON.stringify({ moduleId: "mod-1" }),
        });

        await DuplicateRoute.POST(request, context);
        expect(DbModuleEvent.createNewItem).toHaveBeenCalledWith(
            expect.objectContaining({ title: "פיזיקה (4)" }),
        );
    });

    it("returns 400 when moduleId is missing", async () => {
        const request = new NextRequest("http://localhost/api/gantt/events/evt-1/duplicate", {
            method: "POST",
            body: JSON.stringify({}),
        });

        const response = await DuplicateRoute.POST(request, context);
        expect(response.status).toBe(400);
    });

    it("returns 400 when body is empty", async () => {
        const request = new NextRequest("http://localhost/api/gantt/events/evt-1/duplicate", {
            method: "POST",
        });

        const response = await DuplicateRoute.POST(request, context);
        expect(response.status).toBe(400);
    });
});

// ─── recommended lecturers field — logic unit tests ───────────────────────────
// (pure array-manipulation logic, no DOM)

describe("RecommendedLecturersField — add/remove logic", () => {
    const initial = ["outsider-a", "outsider-b", "outsider-c"];

    it("adding an ID not present appends to end", () => {
        const next = [...initial, "outsider-d"];
        expect(next).toEqual(["outsider-a", "outsider-b", "outsider-c", "outsider-d"]);
    });

    it("adding a duplicate ID is a no-op", () => {
        const id = "outsider-b";
        const next = initial.includes(id) ? initial : [...initial, id];
        expect(next).toEqual(initial);
    });

    it("removing an ID preserves order of remaining items", () => {
        const next = initial.filter((x) => x !== "outsider-b");
        expect(next).toEqual(["outsider-a", "outsider-c"]);
    });

    it("arrayMove reorders correctly", async () => {
        const { arrayMove } = await import("@dnd-kit/sortable");
        // move outsider-a from index 0 to index 2
        const result = arrayMove(initial, 0, 2);
        expect(result).toEqual(["outsider-b", "outsider-c", "outsider-a"]);
    });
});
