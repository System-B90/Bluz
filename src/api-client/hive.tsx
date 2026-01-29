import { safeApiFetcher } from "@/api-client/common";
import { Class, ClassTypeEnum, CourseUser } from "@/api-server/hive/types";
import { Module } from "@/components/schedule/types/module";
import { Subject } from "@/components/schedule/types/subject";

export async function apiGetStudents()
{
    return (await safeApiFetcher('/api/hive/students')) as Array<CourseUser>;
}

export async function apiGetClasses()
{
    return (await safeApiFetcher('/api/hive/classes')) as Array<Class>;
}

export async function apiGetSubjects()
{
    return (await safeApiFetcher('/api/hive/subjects')) as Array<Subject>;
}

export async function apiGetRooms()
{
    return ((await safeApiFetcher('/api/hive/rooms')) as Array<Class>).filter((r) => r.type === ClassTypeEnum.Room);
}

export async function getHiveUsers()
{
    return (await safeApiFetcher('/api/hive/users')) as Array<CourseUser>;
}
export async function apiGetModules()
{
    return (await safeApiFetcher('/api/hive/modules')) as Array<Module>;
}

export function getHiveBaseUrl()
{
    return process.env.NEXT_PUBLIC_HIVE_API_URL || 'https://hive.org';
}
