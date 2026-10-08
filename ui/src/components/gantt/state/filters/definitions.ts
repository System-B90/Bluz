import { Course, CourseId } from "@/api-shared/types/course";
import { GanttSyllabus } from "@/api-shared/types/gantt/models";
import { CourseUser } from "@/api-shared/types/hive";

export type GanttFilterValues = {
    courseIds: Array<CourseId>;
    leadInstructorIds: Array<number>;
    /** Shuffle names: a syllabus passes when it has any of them (#886). */
    shuffleNames: Array<string>;
};

export type GanttFilterKey = keyof GanttFilterValues;

/** Lookups the filter descriptions need to turn ids into names. */
export type GanttFilterLookups = {
    getCourse: (id: CourseId) => Course | undefined;
    getInstructor: (id: number) => CourseUser | undefined;
};

/**
 * One gantt filter: how to tell it is set, whether a syllabus passes it, and
 * how to phrase it. Adding a filter is a new entry here plus a control in the
 * popover; the provider ANDs every active definition (#702).
 */
export type GanttFilterDefinition<K extends GanttFilterKey = GanttFilterKey> = {
    key: K;
    isActive: (value: GanttFilterValues[K]) => boolean;
    matches: (syllabus: GanttSyllabus, value: GanttFilterValues[K]) => boolean;
    describe: (value: GanttFilterValues[K], lookups: GanttFilterLookups) => string;
};

export const EMPTY_GANTT_FILTERS: GanttFilterValues = {
    courseIds: [],
    leadInstructorIds: [],
    shuffleNames: [],
};

const joinNames = (names: Array<string>) =>
    names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} או ${names.at(-1)}`;

const courseFilter: GanttFilterDefinition<"courseIds"> = {
    key: "courseIds",
    isActive: (value) => value.length > 0,
    matches: (syllabus, value) =>
        (syllabus.courseIds ?? []).some((id) => value.includes(id)),
    describe: (value, { getCourse }) =>
        `משויכים למסלול ${joinNames(value.map((id) => getCourse(id)?.name ?? id))}`,
};

const leadInstructorFilter: GanttFilterDefinition<"leadInstructorIds"> = {
    key: "leadInstructorIds",
    isActive: (value) => value.length > 0,
    matches: (syllabus, value) =>
        (syllabus.leadInstructorIds ?? []).some((id) => value.includes(id)),
    describe: (value, { getInstructor }) =>
        `באחריות ${joinNames(
            value.map((id) => getInstructor(id)?.display_name ?? String(id)),
        )}`,
};

const shuffleFilter: GanttFilterDefinition<"shuffleNames"> = {
    key: "shuffleNames",
    isActive: (value) => value.length > 0,
    matches: (syllabus, value) =>
        (syllabus.shuffles ?? []).some((name) => value.includes(name)),
    describe: (value) => `כוללים את השאפל ${joinNames(value)}`,
};

export const GANTT_FILTER_DEFINITIONS: Array<GanttFilterDefinition> = [
    courseFilter as GanttFilterDefinition,
    leadInstructorFilter as GanttFilterDefinition,
    shuffleFilter as GanttFilterDefinition,
];

/** Every shuffle name used by syllabuses, sorted, for the shuffle filter. */
export function shuffleFilterOptions(syllabuses: Iterable<Pick<GanttSyllabus, "shuffles"> | undefined>): Array<string>
{
    const names = new Set<string>();
    for (const syllabus of syllabuses) for (const name of syllabus?.shuffles ?? []) names.add(name);
    return [ ...names ].sort((a, b) => a.localeCompare(b, "he"));
}
