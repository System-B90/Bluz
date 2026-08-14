// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The runtime logo is fetched as a plain <img> from the Hive server.
 *
 * A server-rendered <img> starts loading before React hydrates, so a fast
 * failure (e.g. a 503) fires and finishes before hydration attaches the
 * onError listener — the browser never refires it, and the element used to
 * sit there broken. An Image probe in an effect catches that race; onError
 * remains a backup for a failure that happens later.
 *
 * The probe must not be a fetch: Hive serves /static/ with no CORS headers,
 * so a cross-origin fetch fails regardless of whether the icon is there, and
 * the logo would degrade to the generic mark on every deploy.
 */

import { HiveLogo } from "@/components/base/HiveLogo";

/**
 * jsdom never actually loads images, so drive the probe by hand: capture the
 * Image the component constructs and fire the outcome under test at it.
 */
function captureProbe(): { fire: (event: "error" | "load") => void }
{
    const RealImage = globalThis.Image;
    let probe: HTMLImageElement | undefined;

    class ProbeImage extends RealImage
    {
        constructor()
        {
            super();
            probe = this as unknown as HTMLImageElement;
        }
    }
    vi.stubGlobal("Image", ProbeImage);

    return {
        fire: (event) =>
        {
            if (!probe) throw new Error("component never constructed an Image");
            probe.dispatchEvent(new Event(event));
        },
    };
}

afterEach(() =>
{
    vi.unstubAllGlobals();
    cleanup();
});

describe("HiveLogo", () =>
{
    it("falls back to the generic logo when the probe fails (missed onError race)", async () =>
    {
        const probe = captureProbe();
        render(<HiveLogo generic={ false } size={ 24 } />);

        probe.fire("error");

        await waitFor(() =>
            expect(screen.queryByRole("img", { name: "Hive Logo" })).toBeNull(),
        );
        expect(document.querySelector("path#V")).toBeTruthy();
    });

    it("falls back to the generic logo when onError fires directly", () =>
    {
        captureProbe();
        render(<HiveLogo generic={ false } size={ 24 } />);

        fireEvent.error(screen.getByRole("img", { name: "Hive Logo" }));

        expect(screen.queryByRole("img", { name: "Hive Logo" })).toBeNull();
        expect(document.querySelector("path#V")).toBeTruthy();
    });

    it("keeps the runtime image when the probe loads", async () =>
    {
        const probe = captureProbe();
        render(<HiveLogo generic={ false } size={ 24 } />);

        probe.fire("load");

        await waitFor(() =>
            expect(screen.getByRole("img", { name: "Hive Logo" })).toBeTruthy(),
        );
        expect(document.querySelector("path#V")).toBeNull();
    });

    it("does not probe with fetch — Hive's /static/ has no CORS headers", () =>
    {
        captureProbe();
        const fetchSpy = vi.fn();
        vi.stubGlobal("fetch", fetchSpy);

        render(<HiveLogo generic={ false } size={ 24 } />);

        expect(fetchSpy).not.toHaveBeenCalled();
    });
});
