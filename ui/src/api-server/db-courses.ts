import { FindOptions, UpdateOptions } from "mongodb";

import { pickFields } from "@/api-server/common";
import {
    databaseController,
    DatabaseController,
} from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { ClientApiError } from "@/api-shared/errors";
import { Course } from "@/api-shared/types/course";
import { MessageTypes } from "@/settings";

// Client payloads are copied field-by-field, so the document shape is an
// explicit allow-list rather than whatever the caller sent (#538 item 4).
const COURSE_FIELDS = [
    "id",
    "name",
    "color",
    "parentId",
    "instructorIds",
    "description",
] as const;

async function getDbCourses(
    options?: FindOptions,
    controller: DatabaseController = databaseController,
): Promise<Array<Course>> {
    const data = controller.courses.find({}, options);
    return await data.toArray();
}

async function setDbCourse(
    course: Course,
    options?: UpdateOptions,
    controller: DatabaseController = databaseController,
) {
    // Same allow-list as create: the payload is client-supplied (#538 item 4).
    const { id: courseId, ...courseData } = pickFields(course, COURSE_FIELDS);
    const data = await controller.courses.updateOne(
        { id: courseId },
        { $set: courseData },
        options,
    );
    if (data.matchedCount === 0 && !options?.upsert) {
        throw new ClientApiError(`No course by id ${courseId} found!`);
    }
    SendServerRequestToSessionServer(MessageTypes.COURSES_UPDATE, {
        courses: { [courseId]: course },
    });
}

async function createDbCourse(
    course: Course,
    controller: DatabaseController = databaseController,
) {
    const document = pickFields(course, COURSE_FIELDS);
    await controller.courses.insertOne(document as Course);
    SendServerRequestToSessionServer(MessageTypes.COURSES_UPDATE, {
        courses: { [course.id]: course },
    });
    return course;
}

async function deleteDbCourse(
    courseId: Course["id"],
    controller: DatabaseController = databaseController,
) {
    const data = await controller.courses.deleteOne({ id: courseId });
    if (data.deletedCount === 0) {
        throw new ClientApiError(`No course by id ${courseId} found!`);
    }
    SendServerRequestToSessionServer(MessageTypes.COURSES_UPDATE, {
        courses: { [courseId]: null },
    });
}

export namespace DbCourses {
    export const get = getDbCourses;
    export const set = setDbCourse;
    export const create = createDbCourse;
    export const del = deleteDbCourse;
}
