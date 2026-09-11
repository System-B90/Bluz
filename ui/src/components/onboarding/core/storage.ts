import { OnboardingStorage, Tour } from "@/components/onboarding/types";

export type TourCompletion = {
    version: number;
    at: string;
    reason: "completed" | "dismissed";
};

export type CompletionMap = Record<string, TourCompletion>;

/**
 * `localStorage`, minus the ways it throws: Safari's private mode, a server
 * render, and a browser configured to block site data all end up as a no-op
 * store rather than a crash on first paint.
 */
export const browserStorage: OnboardingStorage = {
    read(key) {
        try {
            return globalThis.localStorage?.getItem(key) ?? null;
        } catch {
            return null;
        }
    },
    write(key, value) {
        try {
            globalThis.localStorage?.setItem(key, value);
        } catch {
            // Nothing to do — onboarding simply repeats next session.
        }
    },
};

export function completionsKey(namespace: string): string {
    return `${namespace}:onboarding:completions:v1`;
}

export function readCompletions(
    storage: OnboardingStorage,
    namespace: string,
): CompletionMap {
    const raw = storage.read(completionsKey(namespace));
    if (!raw) return {};

    try {
        const parsed: unknown = JSON.parse(raw);
        return typeof parsed === "object" && parsed !== null
            ? (parsed as CompletionMap)
            : {};
    } catch {
        return {};
    }
}

export function writeCompletions(
    storage: OnboardingStorage,
    namespace: string,
    completions: CompletionMap,
): void {
    storage.write(completionsKey(namespace), JSON.stringify(completions));
}

/**
 * A tour counts as done only while its recorded version still matches. Bumping
 * `Tour.version` is therefore how a materially rewritten tour is shown again to
 * users who already saw the old one.
 */
export function isTourCompleted(
    completions: CompletionMap,
    tour: Pick<Tour, "id" | "version">,
): boolean {
    const record = completions[tour.id];
    if (!record) return false;

    return record.version >= (tour.version ?? 1);
}
