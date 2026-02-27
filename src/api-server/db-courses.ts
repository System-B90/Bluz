import databaseController from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { ClientApiError } from "@/api-shared/errors";
import { Course } from "@/api-shared/types/course";
import { MessageTypes } from "@/settings";
import { FindOptions, ObjectId, UpdateOptions } from "mongodb";

async function getDbCourses(options?: FindOptions): Promise<Array<Course>>
{
    const data = databaseController.courses.find({}, options);
    return await data.toArray();
}

async function setDbCourse(course: Course, options?: UpdateOptions)
{
    const data = await databaseController.courses.updateOne({ 'id': course.id }, { '$set': course }, options);
    if (data.matchedCount === 0 && !options?.upsert)
    {
        throw new ClientApiError(`No course by id ${course.id} found!`);
    }
    if (data.modifiedCount === 0)
    {
        throw new ClientApiError(`Course ${course.id} data not modified!`);
    }
    SendServerRequestToSessionServer(MessageTypes.COURSES_UPDATE, { courses: { [ course.id ]: course } } as any);
}

async function createDbCourse(course: Course)
{
    await databaseController.courses.insertOne(course as Course);
    SendServerRequestToSessionServer(MessageTypes.COURSES_UPDATE, { courses: { [ course.id ]: course } } as any);
    return course;
}

async function deleteDbCourse(courseId: Course[ 'id' ])
{
    const data = await databaseController.courses.deleteOne({ 'id': courseId });
    if (data.deletedCount === 0)
    {
        throw new ClientApiError(`No course by id ${courseId} found!`);
    }
    SendServerRequestToSessionServer(MessageTypes.COURSES_UPDATE, { courses: { [ courseId ]: null } } as any);
}

export namespace DbCourses
{
    export const get = getDbCourses;
    export const set = setDbCourse;
    export const create = createDbCourse;
    export const del = deleteDbCourse;
}
