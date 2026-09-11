import { getServerSession } from "next-auth";
import { getServerSession as getServerSessionInLayout } from "next-auth/next";
import { beforeEach, describe, expect, it, vi } from "vitest";

/*
 * The routing half of the student boundary (#656). Every staff page lives
 * under `app/(themed)/(post-auth)/`, so that layout's clearance check is what
 * keeps a student session out of all of them — and it must redirect silently,
 * revealing nothing about what else exists.
 */

/*
 * The layout imports `getServerSession` from `next-auth/next`, a different
 * module specifier than the suite-wide mock in `setup-session.ts` covers, so
 * it needs its own — vitest keys mocks by resolved module.
 */
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));

vi.mock("@/api-server/hive/health", () => ({
    isHiveReachable: vi.fn(async () => true),
}));

// `redirect()` throws in Next so control never returns to the caller; the fake
// keeps that contract and records the destination.
class RedirectError extends Error {
    constructor(public readonly destination: string) {
        super(`NEXT_REDIRECT:${destination}`);
    }
}
vi.mock("next/navigation", () => ({
    redirect: vi.fn((destination: string) => {
        throw new RedirectError(destination);
    }),
}));

import { getStaffSession } from "@/api-server/session-user";
import { Clearance } from "@/api-shared/types/hive";
import { STUDENT_VIEW_PATH } from "@/api-shared/types/student-view";
import PostAuthLayout from "@/app/(themed)/(post-auth)/layout";

function asClearance(clearance: Clearance) {
    const session = {
        user: { clearance, display_name: "מישהו", id: "u1" },
    };
    vi.mocked(getServerSession).mockResolvedValue(session as never);
    vi.mocked(getServerSessionInLayout).mockResolvedValue(session as never);
}

/** Runs the layout and reports where it redirected, or null if it rendered. */
async function destinationOf(): Promise<null | string> {
    try {
        await PostAuthLayout({ children: null });
        return null;
    } catch (error) {
        if (error instanceof RedirectError) return error.destination;
        throw error;
    }
}

beforeEach(() => vi.clearAllMocks());

describe("(post-auth) layout clearance gate", () => {
    it("sends a Hanich session to the student view", async () => {
        asClearance(Clearance.Hanich);

        expect(await destinationOf()).toBe(STUDENT_VIEW_PATH);
    });

    it("sends a Checker session there too — staff means Segel or Admin", async () => {
        asClearance(Clearance.Checker);

        expect(await destinationOf()).toBe(STUDENT_VIEW_PATH);
    });

    it("renders the staff shell for Segel", async () => {
        asClearance(Clearance.Segel);

        expect(await destinationOf()).toBeNull();
    });

    it("renders the staff shell for Admin", async () => {
        asClearance(Clearance.Admin);

        expect(await destinationOf()).toBeNull();
    });

    it("sends an unauthenticated visitor to login, not to the student view", async () => {
        vi.mocked(getServerSessionInLayout).mockResolvedValue(null as never);

        expect(await destinationOf()).toBe("/login");
    });
});

describe("getStaffSession", () => {
    it("returns nothing for a student, so page code can redirect", async () => {
        asClearance(Clearance.Hanich);

        expect(await getStaffSession()).toBeNull();
    });

    it("returns the user for staff", async () => {
        asClearance(Clearance.Segel);

        expect(await getStaffSession()).toMatchObject({ id: "u1" });
    });

    it("returns nothing when there is no session", async () => {
        vi.mocked(getServerSession).mockResolvedValue(null as never);

        expect(await getStaffSession()).toBeNull();
    });
});
