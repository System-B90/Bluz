// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const handlers: Array<(type: unknown, data: unknown) => void> = [];

vi.mock("notistack", () => ({ enqueueSnackbar: vi.fn() }));
vi.mock("@/components/auth/AuthProvider", () => ({
    useAuth: () => ({
        addMessageHandler: (h: (type: unknown, data: unknown) => void) => {
            handlers.push(h);
            return () => undefined;
        },
    }),
}));
vi.mock("@/components/base/ApiErrorSnackbar", () => ({ enqueueApiErrorSnackbar: vi.fn() }));
vi.mock("@/api-client/custom-colors", () => ({
    apiGetCustomColors: vi.fn(),
    apiDeleteCustomColor: vi.fn(),
    apiCreateCustomColor: vi.fn(),
    apiUpdateCustomColor: vi.fn(),
}));

import { apiDeleteCustomColor, apiGetCustomColors } from "@/api-client/custom-colors";
import type { CustomColor } from "@/api-shared/types/custom-color";
import {
    CustomColorsContextState,
    CustomColorsProvider,
    useCustomColors,
} from "@/components/base/CustomColorsProvider";
import { MessageTypes } from "@/settings";

/**
 * #404: the custom-colours e2e flaked because a deleted colour came back. A
 * list GET issued before the delete resolved after it and overwrote the store
 * with the old list. Late responses must be dropped.
 */
const color = { id: "color-1", name: "ורוד", color: "#f6c4d9" } as unknown as CustomColor;

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => (resolve = r));
    return { promise, resolve };
}

afterEach(() => {
    cleanup();
    handlers.length = 0;
    vi.clearAllMocks();
});

async function mount() {
    let ctx!: CustomColorsContextState;
    const Probe = () => {
        ctx = useCustomColors();
        return null;
    };
    render(<CustomColorsProvider><Probe /></CustomColorsProvider>);
    await act(async () => {});
    return () => ctx;
}

const refresh = () =>
    act(() => handlers.at(-1)!(MessageTypes.CUSTOM_COLORS_UPDATE, null));

describe("CustomColorsProvider — stale list responses (#404)", () => {
    it("a refresh issued before a delete cannot resurrect the colour", async () => {
        const staleLoad = deferred<Array<CustomColor>>();
        vi.mocked(apiGetCustomColors)
            .mockResolvedValueOnce([ color ]) // mount
            .mockReturnValueOnce(staleLoad.promise) // websocket refresh
            .mockResolvedValueOnce([]); // the delete's own resync
        vi.mocked(apiDeleteCustomColor).mockResolvedValue(undefined as never);

        const ctx = await mount();
        expect(ctx().customColors.map((c) => c.id)).toEqual([ "color-1" ]);

        await refresh();
        await act(async () => {
            await ctx().deleteCustomColor("color-1");
        });
        expect(ctx().customColors).toEqual([]);

        // The refresh that still saw the colour lands last.
        await act(async () => {
            staleLoad.resolve([ color ]);
            await staleLoad.promise;
        });

        expect(ctx().customColors).toEqual([]);
    });

    it("of two overlapping refreshes, only the later one is applied", async () => {
        const older = deferred<Array<CustomColor>>();
        const newer = deferred<Array<CustomColor>>();
        vi.mocked(apiGetCustomColors)
            .mockResolvedValueOnce([])
            .mockReturnValueOnce(older.promise)
            .mockReturnValueOnce(newer.promise);

        const ctx = await mount();
        await refresh();
        await refresh();

        await act(async () => {
            newer.resolve([ color ]);
            await newer.promise;
        });
        await act(async () => {
            older.resolve([]);
            await older.promise;
        });

        expect(ctx().customColors.map((c) => c.id)).toEqual([ "color-1" ]);
        expect(ctx().isLoading).toBe(false);
    });
});
