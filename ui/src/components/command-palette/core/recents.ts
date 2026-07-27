import type { CommandId } from "../types";

/**
 * Most-recently-used memory, persisted per browser.
 *
 * Recency is folded into ranking rather than shown as a separate pinned list
 * once the user starts typing — the command you reach for daily should win ties
 * against a command you have never run, without ever outranking a materially
 * better text match.
 */

const MAX_RECENTS = 40;

export type RecentsSnapshot = {
    /** `ids[0]` is the most recently run command. */
    ids: Array<CommandId>;
};

const EMPTY: RecentsSnapshot = { ids: [] };

export class RecentsStore {
    private readonly storageKey: string;
    private snapshot: RecentsSnapshot = EMPTY;
    private loaded = false;

    constructor(namespace: string) {
        this.storageKey = `command-palette:recents:${namespace}`;
    }

    /** Ordered ids, most recent first. Safe to call during SSR (returns `[]`). */
    ids(): Array<CommandId> {
        this.load();
        return this.snapshot.ids;
    }

    /**
     * Ranking multiplier contribution for `id`: a bounded bonus that decays with
     * position, so it breaks ties without overpowering the text score.
     */
    boost(id: CommandId): number {
        const index = this.ids().indexOf(id);
        if (index === -1) return 0;
        return 30 / (1 + index);
    }

    record(id: CommandId): void {
        this.load();
        const ids = [id, ...this.snapshot.ids.filter((x) => x !== id)].slice(
            0,
            MAX_RECENTS,
        );
        this.snapshot = { ids };
        this.persist();
    }

    clear(): void {
        this.snapshot = EMPTY;
        this.persist();
    }

    private load(): void {
        if (this.loaded || typeof window === "undefined") return;
        this.loaded = true;

        try {
            const raw = window.localStorage.getItem(this.storageKey);
            if (!raw) return;
            const parsed: unknown = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                this.snapshot = {
                    ids: parsed.filter(
                        (value): value is string => typeof value === "string",
                    ),
                };
            }
        } catch {
            // Corrupt or unavailable storage is not worth failing the palette
            // over — fall back to an empty history.
        }
    }

    private persist(): void {
        if (typeof window === "undefined") return;
        try {
            window.localStorage.setItem(
                this.storageKey,
                JSON.stringify(this.snapshot.ids),
            );
        } catch {
            // Private-mode / quota failures are non-fatal.
        }
    }
}
