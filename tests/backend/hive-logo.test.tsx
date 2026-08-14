// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The runtime logo is fetched as a plain <img> from the Hive server.
 *
 * A server-rendered <img> starts loading before React hydrates, so a fast
 * failure (e.g. a 503) fires and finishes before hydration attaches the
 * onError listener — the browser never refires it, and the element used to
 * sit there broken. A HEAD check in an effect catches that race; onError
 * remains a backup for a failure that happens later.
 */

import { HiveLogo } from "@/components/base/HiveLogo";

beforeEach(() => {
    vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(null, { status: 200 })),
    );
});

afterEach(() => {
    vi.unstubAllGlobals();
    cleanup();
});

describe("HiveLogo", () => {
    it("falls back to the generic logo when the HEAD check fails (missed onError race)", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(null, { status: 503 })),
        );

        render(<HiveLogo generic={ false } size={ 24 } />);

        await waitFor(() =>
            expect(screen.queryByRole("img", { name: "Hive Logo" })).toBeNull(),
        );
        expect(document.querySelector("path#V")).toBeTruthy();
    });

    it("falls back to the generic logo when onError fires directly", async () => {
        render(<HiveLogo generic={ false } size={ 24 } />);

        const img = screen.getByRole("img", { name: "Hive Logo" });
        fireEvent.error(img);

        expect(screen.queryByRole("img", { name: "Hive Logo" })).toBeNull();
        expect(document.querySelector("path#V")).toBeTruthy();
    });

    it("renders the runtime image when the HEAD check succeeds", async () => {
        render(<HiveLogo generic={ false } size={ 24 } />);

        await waitFor(() => expect(fetch).toHaveBeenCalled());
        expect(screen.getByRole("img", { name: "Hive Logo" })).toBeTruthy();
        expect(document.querySelector("path#V")).toBeNull();
    });
});
