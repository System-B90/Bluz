import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Smoke tests for the standalone migration script bundled into the ui image
 * (Dockerfile's migrate.js). The module runs migrations as an import side
 * effect, so `pg` and the drizzle migrator are faked here: what the test
 * guards against is a bundling regression where the script stops loading or
 * points at the wrong migrations folder / connection env var.
 */

const { pgState, drizzleState } = vi.hoisted(() => ({
    pgState: {
        configs: [] as Array<Record<string, unknown>>,
        connect: vi.fn(async () => undefined),
        end: vi.fn(async () => undefined),
    },
    drizzleState: {
        dbMarker: { __drizzle: true },
        migrate: vi.fn(async () => undefined),
    },
}));

vi.mock("pg", () => {
    class Client {
        constructor(config?: Record<string, unknown>) {
            pgState.configs.push(config ?? {});
            this.connect = pgState.connect;
            this.end = pgState.end;
        }
        connect: () => Promise<void>;
        end: () => Promise<void>;
    }
    return { Client };
});
vi.mock("drizzle-orm/node-postgres", () => ({
    drizzle: vi.fn(() => drizzleState.dbMarker),
}));
vi.mock("drizzle-orm/node-postgres/migrator", () => ({
    migrate: drizzleState.migrate,
}));

describe("drizzle-migrate script", () => {
    let exitSpy: ReturnType<typeof vi.spyOn>;

    const loadScript = async () => await import("@/api-server/drizzle-migrate");

    beforeEach(() => {
        vi.resetModules();
        vi.clearAllMocks();
        vi.stubEnv(
            "DATABASE_URL",
            "postgres://bluz:test@localhost:5432/curriculum_db",
        );
        exitSpy = vi
            .spyOn(process, "exit")
            .mockImplementation((() => undefined) as never);
    });

    afterEach(() => {
        exitSpy.mockRestore();
        vi.unstubAllEnvs();
    });

    it("connects from DATABASE_URL and migrates the bundled ./drizzle folder", async () => {
        await loadScript();

        expect(pgState.configs).toEqual([
            {
                connectionString:
                    "postgres://bluz:test@localhost:5432/curriculum_db",
            },
        ]);
        // The migrator receives the drizzle() handle built on the client…
        expect(vi.mocked(drizzleState.migrate).mock.calls[0][0]).toBe(
            drizzleState.dbMarker,
        );
        // …and the folder must match what the Dockerfile ships.
        expect(vi.mocked(drizzleState.migrate).mock.calls[0][1]).toEqual({
            migrationsFolder: "./drizzle",
        });
        await vi.waitFor(() => expect(pgState.end).toHaveBeenCalled());
        expect(exitSpy).not.toHaveBeenCalled();
    });

    it("exits non-zero when migrations fail", async () => {
        drizzleState.migrate.mockRejectedValueOnce(new Error("syntax error"));
        vi.spyOn(console, "error").mockImplementation(() => {});

        await loadScript();
        await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(1));
    });
});
