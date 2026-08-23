// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for `bluz login` sitting out its full 60s timeout while the
 * browser showed the manual-paste fallback.
 *
 * The widget reaches the CLI's loopback callback server with `fetch()`. Chrome
 * replaced the header-based Private Network Access opt-in with a
 * permission-gated Local Network Access check, so that fetch can be refused no
 * matter what the CLI sends back — and the old code treated a refusal as
 * "give up, paste it by hand". A top-level navigation is not subject to CORS
 * or LNA, so a blocked fetch now hands off to one instead.
 */

import { callbackUrl, CliAuthWidget } from "@/app/(themed)/(post-auth)/cli-auth/cli-auth-widget";

const PORT = "52400";
const HANDOFF_CODE = "handoff-code-value";
const CODE = "ABCD-1234";

beforeEach(() => {
    vi.restoreAllMocks();
});

afterEach(() => {
    cleanup();
});

describe("callbackUrl", () => {
    it("targets the loopback callback path", () => {
        // The verification code rides along so the CLI's callback can refuse
        // a handoff code injected by any other local process (#521). The
        // session token itself never appears here at all (#520) — only the
        // opaque, single-use handoff code the CLI redeems for it separately.
        expect(callbackUrl(PORT, CODE, HANDOFF_CODE)).toBe(
            `http://127.0.0.1:${PORT}/callback?code=${CODE}&handoff=${HANDOFF_CODE}`,
        );
    });

    it("encodes handoff codes containing URL-significant characters", () => {
        // Handoff codes are base64url already, but this must not silently
        // corrupt one carrying `+`, `/` or `=` regardless.
        expect(callbackUrl(PORT, CODE, "a+b/c=d&e")).toBe(
            `http://127.0.0.1:${PORT}/callback?code=${CODE}&handoff=a%2Bb%2Fc%3Dd%26e`,
        );
    });
});

describe("CliAuthWidget", () => {
    it("reports success when the loopback fetch succeeds", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));

        render(<CliAuthWidget code={CODE} port={PORT} handoffCode={HANDOFF_CODE} />);

        expect(await screen.findByText("ההתחברות הושלמה בהצלחה!")).toBeTruthy();
    });

    it("offers the navigation handoff when the browser blocks the fetch", async () => {
        // This is what Chrome's Local Network Access refusal looks like to the
        // page: a rejected promise, indistinguishable from the server being
        // down — which is why the handoff is a button and not an automatic
        // window.open.
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

        render(<CliAuthWidget code={CODE} port={PORT} handoffCode={HANDOFF_CODE} />);

        expect(await screen.findByTestId("cli-auth-handoff")).toBeTruthy();
    });

    it("opens the callback in a new tab on handoff", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
        const open = vi.fn().mockReturnValue({});
        vi.stubGlobal("open", open);

        render(<CliAuthWidget code={CODE} port={PORT} handoffCode={HANDOFF_CODE} />);
        await userEvent.click(await screen.findByTestId("cli-auth-handoff"));

        expect(open).toHaveBeenCalledWith(callbackUrl(PORT, CODE, HANDOFF_CODE), "_blank", "noopener");
    });

    it("navigates the current tab when the popup is blocked", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
        // window.open returns null when the popup blocker wins despite the
        // click gesture. Losing the Bluz tab beats losing the login.
        vi.stubGlobal("open", vi.fn().mockReturnValue(null));
        const assign = vi.fn();
        Object.defineProperty(window, "location", {
            configurable: true,
            value: {
                get href() {
                    return "https://bluz.dev/cli-auth";
                },
                set href(value: string) {
                    assign(value);
                },
            },
        });

        render(<CliAuthWidget code={CODE} port={PORT} handoffCode={HANDOFF_CODE} />);
        await userEvent.click(await screen.findByTestId("cli-auth-handoff"));

        expect(assign).toHaveBeenCalledWith(callbackUrl(PORT, CODE, HANDOFF_CODE));
    });

    it("goes straight to manual paste when the server answers but rejects the handoff code", async () => {
        // A non-ok response proves the CLI server is reachable, so handing off
        // to a new tab would only show the same error.
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));

        render(<CliAuthWidget code={CODE} port={PORT} handoffCode={HANDOFF_CODE} />);

        expect(
            await screen.findByText("לא הצלחנו להתחבר ל-CLI באופן אוטומטי"),
        ).toBeTruthy();
    });

    it("skips the loopback attempt entirely when no port was passed", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);

        render(<CliAuthWidget code={CODE} port="" handoffCode={HANDOFF_CODE} />);

        expect(
            await screen.findByText("לא הצלחנו להתחבר ל-CLI באופן אוטומטי"),
        ).toBeTruthy();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("lets the user drop to manual paste from the handoff screen", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

        render(<CliAuthWidget code={CODE} port={PORT} handoffCode={HANDOFF_CODE} />);
        await userEvent.click(await screen.findByText("העתק את הקוד באופן ידני"));

        await waitFor(() => {
            expect(screen.getByText("לא הצלחנו להתחבר ל-CLI באופן אוטומטי")).toBeTruthy();
        });
    });
});
