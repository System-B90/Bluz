// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Regression tests for the Hive login button hanging silently when
 * `signIn` never settles (e.g. an upstream OAuth timeout) — the button
 * used to spin forever with no feedback. It now races the sign-in
 * against a timeout and surfaces an error snackbar.
 */

const { signIn } = vi.hoisted(() => ({ signIn: vi.fn() }));

vi.mock("next-auth/react", () => ({ signIn }));

import { LoginWithHive } from "@/app/(themed)/(pre-auth)/login/login-with-hive-button";

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
    vi.useRealTimers();
    cleanup();
});

describe("LoginWithHive", () => {
    it("calls signIn with the hive provider on click", async () => {
        const user = userEvent.setup({ delay: null });
        signIn.mockResolvedValueOnce(undefined);

        render(<LoginWithHive callbackUrl="/dashboard" />);
        await user.click(screen.getByRole("button"));

        expect(signIn).toHaveBeenCalledWith("hive", {
            callbackUrl: "/dashboard",
        });
    });

    it("shows a spinner and disables the button while signing in", async () => {
        const user = userEvent.setup({ delay: null });
        signIn.mockReturnValueOnce(new Promise(() => {}));

        render(<LoginWithHive />);
        await user.click(screen.getByRole("button"));

        expect(screen.getByRole("button")).toHaveProperty("disabled", true);
        expect(screen.getByText("מתחברים...")).toBeTruthy();
    });

    it("surfaces an error and resets the button when signIn rejects", async () => {
        const user = userEvent.setup({ delay: null });
        signIn.mockRejectedValueOnce(new Error("network error"));

        render(<LoginWithHive />);
        await user.click(screen.getByRole("button"));

        expect(await screen.findByRole("alert")).toBeTruthy();
        expect(
            screen.getByRole("button", { name: /התחברות עם הייב/ }),
        ).toHaveProperty("disabled", false);
    });

    it("surfaces an error and resets the button when signIn hangs past the timeout", async () => {
        const user = userEvent.setup({ delay: null });
        signIn.mockReturnValueOnce(new Promise(() => {}));

        render(<LoginWithHive />);
        await user.click(screen.getByRole("button"));

        expect(screen.getByRole("button")).toHaveProperty("disabled", true);

        await vi.advanceTimersByTimeAsync(15000);

        expect(await screen.findByRole("alert")).toBeTruthy();
        expect(
            screen.getByRole("button", { name: /התחברות עם הייב/ }),
        ).toHaveProperty("disabled", false);
    });
});
