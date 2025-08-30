import { safeApiFetcher } from "@/api-client/common";
import { Class, CourseUser } from "@/api-server/hive/types";

export async function apiGetStudents()
{
    return (await safeApiFetcher('/api/hive/students')) as Array<CourseUser>;
}

export async function apiGetClasses()
{
    return (await safeApiFetcher('/api/hive/classes')) as Array<Class>;
}
