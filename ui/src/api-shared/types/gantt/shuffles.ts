/**
 * Modules and events that carry a given set of shuffle names — the payload the
 * shuffle-deletion dialog lists before the user confirms the cascade (#485).
 */
export type ShuffleUsageItem = {
    id: string;
    shuffles: Array<string>;
    title: string;
};

export type ShuffleUsages = {
    events: Array<ShuffleUsageItem>;
    modules: Array<ShuffleUsageItem>;
};
