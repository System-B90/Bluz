import { vi } from "vitest";

/**
 * Shared in-memory `ws` transport for the session-server tests.
 *
 * The websocket suites all need the same thing: run the REAL shared server
 * core, but without binding a port or waiting on a clock. Each suite used to
 * carry its own copy of these classes, and the copies had already started to
 * drift (differing `afterEach` teardown, differing helper surfaces) — which is
 * how one suite quietly stops catching what another one does.
 *
 * Nothing here is a mock of the code under test. The core's real
 * `startSessionServer` runs; only the socket layer beneath it is faked.
 */

export class FakeWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;

    readyState = FakeWebSocket.OPEN;
    sent: Array<string> = [];
    closedWith: Array<[ code: number | undefined, reason: string | undefined ]> = [];

    private handlers = new Map<string, Array<(...args: Array<any>) => void>>();

    send(data: string) {
        this.sent.push(String(data));
    }

    close(code?: number, reason?: string) {
        this.closedWith.push([ code, reason ]);
        this.readyState = FakeWebSocket.CLOSED;
        this.emit("close");
    }

    terminate() {
        this.readyState = FakeWebSocket.CLOSED;
    }

    ping() {}

    on(event: string, handler: (...args: Array<any>) => void) {
        const handlers = this.handlers.get(event) ?? [];
        handlers.push(handler);
        this.handlers.set(event, handlers);
    }

    /** Test-side trigger for handlers the core registered via `on`. */
    emit(event: string, ...args: Array<any>) {
        for (const handler of this.handlers.get(event) ?? []) {
            handler(...args);
        }
    }

    /** Frames this socket received, parsed. */
    received(): Array<Record<string, any>> {
        return this.sent.map((frame) => JSON.parse(frame));
    }

    receivedOfType(type: string): Array<Record<string, any>> {
        return this.received().filter((frame) => frame.type === type);
    }
}

/**
 * Registries live on globalThis, not in module scope.
 *
 * `loadSessionServer` calls `vi.resetModules()` so the entry point re-runs its
 * import-time setup, which also re-imports this module inside the `vi.mock`
 * factories. Module-level statics would therefore be a *different* array from
 * the one the test file holds, and the server the core just constructed would
 * be invisible. Anchoring on globalThis keeps one registry across resets.
 */
const REGISTRY = ((globalThis as any).__bluzFakeWs ??= {
    instances: [] as Array<FakeWebSocketServer>,
    servers: [] as Array<{ close: () => void }>,
});

export class FakeWebSocketServer {
    static get instances(): Array<FakeWebSocketServer> {
        return REGISTRY.instances;
    }

    static set instances(next: Array<FakeWebSocketServer>) {
        REGISTRY.instances = next;
    }

    options: Record<string, unknown>;

    private handlers = new Map<string, Array<(...args: Array<any>) => void>>();

    constructor(options: Record<string, unknown>) {
        this.options = options;
        FakeWebSocketServer.instances.push(this);
    }

    on(event: string, handler: (...args: Array<any>) => void) {
        const handlers = this.handlers.get(event) ?? [];
        handlers.push(handler);
        this.handlers.set(event, handlers);
    }

    emit(event: string, ...args: Array<any>) {
        for (const handler of this.handlers.get(event) ?? []) {
            handler(...args);
        }
    }

    close(onClose?: () => void) {
        onClose?.();
    }
}

/** Servers started during a test, so a suite can close them in `afterEach`. */
export const activeServers: Array<{ close: () => void }> = REGISTRY.servers;

/**
 * Imports session-server.ts fresh and hands back the WebSocketServer the core
 * constructed. `resetModules` first because the entry point registers its
 * handlers at import time.
 */
export async function loadSessionServer(): Promise<FakeWebSocketServer> {
    vi.resetModules();
    await import("../../session-server/session-server");
    const wss = REGISTRY.instances.at(-1);
    if (!wss) {
        throw new Error("startSessionServer did not construct a WebSocketServer");
    }
    return wss;
}

/** Resets registries between tests. Call from `beforeEach`. */
export function resetFakeTransport(): void {
    REGISTRY.instances.length = 0;
    REGISTRY.servers.length = 0;
}

/** Closes anything still running. Call from `afterEach`. */
export function closeActiveServers(): void {
    for (const server of REGISTRY.servers) server.close();
    REGISTRY.servers.length = 0;
}
