import { Color } from "@/api-shared/common";

export type CourseId = string;
export type Course = {
    id: CourseId;
    name: string;
    color: Color | null;
    parentId?: null | string;
    instructorIds?: Array<number>;
    /** Optional free-text description (e.g. provenance of auto-created courses). */
    description?: string;
};

export type ApiCourseCreatePayload = Course;
export type ApiCourseCreateResponse = Course;

export type ApiCourseGetPayload = void;
export type ApiCourseGetResponse = Array<Course>;

export type ApiCourseUpdatePayload = Course;
export type ApiCourseUpdateResponse = Course;

export type ApiCourseDeletePayload = CourseId;
export type ApiCourseDeleteResponse = void;
