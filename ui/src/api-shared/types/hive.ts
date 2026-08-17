import { Class, CourseUser, Lesson, Queue } from "@system-b90/hive-core";

import { HiveRoom } from "@/api-shared/types/room";

/*
 * Hive entity types now live in @system-b90/hive-core; this module remains
 * the app-side import path (`@/api-shared/types/hive`) and keeps the
 * Bluz-specific API payload/response aliases.
 */
export {
    ClassTypeEnum,
    Clearance,
    clearanceName,
    GenderEnum,
    QueueType,
    StatusEnum,
} from "@system-b90/hive-core";
export type {
    Class,
    CourseUser,
    Lesson,
    LessonRequest,
    LessonRule,
    LessonRuleRequest,
    Queue,
} from "@system-b90/hive-core";

/**
 * A Hive lesson as the *server* actually returns it.
 *
 * Hive renamed the module foreign key to `module_id` on the lesson serializer
 * (both directions: `LessonRequest.module_id` and `Lesson.module_id`), while
 * `@system-b90/hive-core` still types it as `module`. Instances of both shapes
 * are in the wild, so Bluz reads whichever is present and writes both.
 */
export type HiveLesson = Lesson & { module_id?: number };

/**
 * The module a lesson belongs to, whichever field the Hive instance uses.
 * @param lesson A lesson as returned by Hive.
 * @returns The module id, or undefined if the lesson carries neither field.
 */
export function lessonModuleId(
    lesson: HiveLesson | undefined,
): number | undefined {
    return lesson?.module_id ?? lesson?.module;
}

export type ApiHiveStudentsGetPayload = void;
export type ApiHiveStudentsGetResponse = Array<CourseUser>;

export type ApiHiveClassesGetPayload = void;
export type ApiHiveClassesGetResponse = Array<Class>;

export type ApiHiveUsersGetPayload = void;
export type ApiHiveUsersGetResponse = Array<CourseUser>;

export type ApiHiveRoomsGetPayload = void;
export type ApiHiveRoomsGetResponse = Array<HiveRoom>;

export type ApiHiveLessonsGetPayload = {
    module__id?: number;
    module__parent_subject__parent_program_id__in?: Array<number> | string;
} | void;
export type ApiHiveLessonsGetResponse = Array<Lesson>;

/** Queues of a single Hive module — the queues a lesson rule may point at. */
export type ApiHiveQueuesGetPayload = { module: number };
export type ApiHiveQueuesGetResponse = Array<Queue>;
