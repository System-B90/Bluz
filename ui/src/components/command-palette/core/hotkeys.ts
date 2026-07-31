const MODIFIER_KEYS: Record<string, keyof Pick<
    KeyboardEvent,
    "altKey" | "ctrlKey" | "metaKey" | "shiftKey"
>> = {
    ctrl: "ctrlKey",
    control: "ctrlKey",
    shift: "shiftKey",
    alt: "altKey",
    option: "altKey",
    meta: "metaKey",
    cmd: "metaKey",
    "⌘": "metaKey",
};

/** Matches a `Command.shortcut` chip list (e.g. `["Ctrl", "Z"]`) against a live keydown event. */
export function matchesShortcut(
    event: KeyboardEvent,
    shortcut: Array<string>,
): boolean {
    if (shortcut.length === 0) return false;

    const modifiers = new Set<string>();
    let key: null | string = null;

    for (const token of shortcut) {
        const modifier = MODIFIER_KEYS[token.toLowerCase()];
        if (modifier) {
            modifiers.add(modifier);
        } else {
            key = token;
        }
    }
    if (key === null) return false;

    for (const modifier of ["ctrlKey", "shiftKey", "altKey", "metaKey"] as const) {
        if (event[modifier] !== modifiers.has(modifier)) return false;
    }

    return event.key.toLowerCase() === key.toLowerCase();
}
