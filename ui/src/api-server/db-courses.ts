import { FindOptions, UpdateOptions } from "mongodb";

import {
    databaseController,
    DatabaseController,
} from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { ClientApiError } from "@/api-shared/errors";
import { Course } from "@/api-shared/types/course";
import { MessageTypes } from "@/settings";

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
    const { _id: _, id: courseId, ...courseData } = course as any;
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
    await controller.courses.insertOne(course as Course);
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
