import { fixId } from "@/api-server/event";
import databaseController from "@/api-server/mongo-db-controller";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { ClientApiError } from "@/api-shared/errors";
import { Course } from "@/api-shared/types/course";
import { MessageTypes } from "@/settings";
import { FindOptions, ObjectId, UpdateOptions } from "mongodb";

async function getDbCourses(options?: FindOptions): Promise<Array<Course>>
{
    const data = databaseController.courses.find({}, options);
    return (await data.toArray()).map((c) => fixId(c));
}

async function setDbCourse(course: Course, options?: UpdateOptions)
{
    const data = await databaseController.courses.updateOne({ '_id': new ObjectId(course.id) }, { '$set': course }, options);
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

async function createDbCourse(course: Omit<Course, 'id'>)
{
    const data = await databaseController.courses.insertOne(course as Course);
    const newCourse = { ...course, id: data.insertedId.toString() };
    SendServerRequestToSessionServer(MessageTypes.COURSES_UPDATE, { courses: { [ newCourse.id ]: newCourse } } as any);
    databaseController.courses.updateOne({ '_id': data.insertedId }, { '$set': { id: newCourse.id } });
    return newCourse;
}

async function deleteDbCourse(courseId: Course[ 'id' ])
{
    const data = await databaseController.courses.deleteOne({ '_id': new ObjectId(courseId) });
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
