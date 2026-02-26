import { safeApiFetcher } from "@/api-client/common";
import { Class, ClassTypeEnum, CourseUser } from "@/api-server/hive/types";
import { Module } from "@/components/schedule/types/module";
import { HiveRoom } from "@/components/schedule/types/room";
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

async function apiGetHiveRooms()
{
    return ((await safeApiFetcher('/api/hive/rooms')) as Array<HiveRoom>);
}

export async function getHiveUsers()
{
    return (await safeApiFetcher('/api/hive/users')) as Array<CourseUser>;
}
export async function apiGetModules()
{
    return (await safeApiFetcher('/api/hive/modules')) as Array<Module>;
}
