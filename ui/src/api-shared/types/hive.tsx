import { Class, CourseUser, Lesson } from "@system-b90/hive-core";

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
