import { EventType } from "@/api-shared/types/event";

export const STUDENT_VIEW_SETTING_KEY = "studentView";

/**
 * How `/student-view` names an event (#744). Students should not learn an
 * event's real name, so the default shows only its type and the Hive
 * subject's symbol.
 */
export enum StudentEventNameMode {
    /** "{type label} {subject symbol}", e.g. `ע"ע פא`, `הרצאת פא`. */
    SYMBOL = "symbol",
    /** The event's real name, as staff see it. */
    FULL = "full",
}

export type StudentViewSettings = {
    eventNameMode: StudentEventNameMode;
    /**
     * Per-type label placed before the subject symbol. Missing types fall back
     * to `DEFAULT_STUDENT_TYPE_LABELS`.
     */
    typeLabels: Partial<Record<EventType, string>>;
};

/** Types whose real name is shown even in symbol mode: nothing to hide. */
export const STUDENT_NAME_PASSTHROUGH_TYPES: ReadonlySet<EventType> = new Set([
    EventType.BREAK,
    EventType.PRAYER,
]);

/** Types whose label can be edited in settings, in display order. */
export const STUDENT_LABELLED_TYPES: ReadonlyArray<EventType> = [
    EventType.EXERCISE,
    EventType.LECTURE,
    EventType.WORKSHOP,
    EventType.SELF_TEACHING,
    EventType.OTHER,
];

export const DEFAULT_STUDENT_TYPE_LABELS: Readonly<Record<EventType, string>> = {
    [EventType.EXERCISE]: 'ע"ע',
    [EventType.LECTURE]: "הרצאת",
    [EventType.WORKSHOP]: "סדנת",
    [EventType.SELF_TEACHING]: 'ל"ע',
    [EventType.BREAK]: EventType.BREAK,
    [EventType.PRAYER]: EventType.PRAYER,
    [EventType.OTHER]: "",
};

export const DEFAULT_STUDENT_VIEW_SETTINGS: StudentViewSettings = {
    eventNameMode: StudentEventNameMode.SYMBOL,
    typeLabels: {},
};

/** Fallback when a type has no label and no symbol resolves: never the real name. */
const HIDDEN_NAME = "פעילות";

export function isStudentViewSettings(value: unknown): value is StudentViewSettings {
    if (!value || typeof value !== "object") return false;
    const { eventNameMode, typeLabels } = value as Record<string, unknown>;
    if (!Object.values(StudentEventNameMode).includes(eventNameMode as StudentEventNameMode)) return false;
    if (!typeLabels || typeof typeLabels !== "object" || Array.isArray(typeLabels)) return false;
    return Object.entries(typeLabels).every(
        ([ type, label ]) =>
            Object.values(EventType).includes(type as EventType) && typeof label === "string",
    );
}

/** Stored value merged over defaults; anything malformed reads as the defaults. */
export function resolveStudentViewSettings(value: unknown): StudentViewSettings {
    return isStudentViewSettings(value) ? value : DEFAULT_STUDENT_VIEW_SETTINGS;
}

/**
 * The name a student sees for an event. In symbol mode the real name is only
 * used for break/prayer; everything else is built from the type label and the
 * subject symbol, and degrades to the label (or a generic word) rather than
 * falling back to the real name.
 */
export function studentEventName(
    event: { name: string; type: EventType },
    subjectSymbol: null | string | undefined,
    settings: StudentViewSettings,
): string {
    if (settings.eventNameMode === StudentEventNameMode.FULL) return event.name;
    if (STUDENT_NAME_PASSTHROUGH_TYPES.has(event.type)) return event.name;

    const label = (settings.typeLabels[event.type] ?? DEFAULT_STUDENT_TYPE_LABELS[event.type] ?? "").trim();
    const symbol = subjectSymbol?.trim() ?? "";
    return [ label, symbol ].filter(Boolean).join(" ") || HIDDEN_NAME;
}
