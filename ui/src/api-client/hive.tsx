import { safeApiFetcher } from "@/api-client/common";
import { Class, CourseUser } from "@/api-shared/types/hive";
import { Module } from "@/api-shared/types/module";
import { HiveRoom } from "@/api-shared/types/room";
import { Subject } from "@/api-shared/types/subject";

export async function apiGetStudents() {
    return await safeApiFetcher<Array<CourseUser>>("/api/hive/students");
}

export async function apiGetClasses() {
    return await safeApiFetcher<Array<Class>>("/api/hive/classes");
}

export async function apiGetSubjects() {
    return await safeApiFetcher<Array<Subject>>("/api/hive/subjects");
}

// TODO: Is this function actually needed? Rooms are a subtype of class in Hive
export async function apiGetHiveRooms() {
    return await safeApiFetcher<Array<HiveRoom>>("/api/hive/rooms");
}

export async function getHiveUsers() {
    return await safeApiFetcher<Array<CourseUser>>("/api/hive/users");
}

export async function apiGetModules() {
    return await safeApiFetcher<Array<Module>>("/api/hive/modules");
}
