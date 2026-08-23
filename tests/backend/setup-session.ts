/*
 * Backend route tests exercise handlers directly, without NextAuth in the
 * loop. Since every calendar/org handler now gates on `requireStaffSession()`
 * (#509, #510), the default for a test is an authenticated Segel session —
 * otherwise every route test would 401 on auth rather than on the behaviour it
 * is asserting. Individual files can still `vi.mock` the module to assert the
 * unauthenticated path.
 */
import { vi } from "vitest";

import { Clearance } from "@/api-shared/types/hive";

export const TEST_SESSION_USER = {
    id: "test-user",
    name: "Test Staff",
    display_name: "Test Staff",
    clearance: Clearance.Segel,
};

vi.mock("next-auth", async (importOriginal) => {
    const actual = await importOriginal<typeof import("next-auth")>();
    return {
        ...actual,
        default: (actual as { default?: unknown }).default,
        getServerSession: vi.fn(async () => ({ user: TEST_SESSION_USER })),
    };
});
