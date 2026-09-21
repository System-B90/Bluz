import { Class, CourseUser, Lesson, LessonId, Queue } from "@system-b90/hive-core";

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
    lessonModuleId,
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

/** App-side names for hive-core's lesson id / lesson (UUID + `module_id` aware). */
export type HiveLessonId = LessonId;
export type HiveLesson = Lesson;

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
export type ApiHiveLessonsGetResponse = Array<HiveLesson>;

/** Queues of a single Hive module — the queues a lesson rule may point at. */
export type ApiHiveQueuesGetPayload = { module: number };
export type ApiHiveQueuesGetResponse = Array<Queue>;
