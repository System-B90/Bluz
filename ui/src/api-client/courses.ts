import { safeApiFetcher } from "@/api-client/common";
import { Course, CourseId } from "@/api-shared/types/course";

export async function apiGetCourses(): Promise<Array<Course>> {
    return await safeApiFetcher<Array<Course>>("/api/course");
}

export async function apiSetCourse(course: Course): Promise<Course> {
    return await safeApiFetcher<Course>("/api/course", {
        method: "POST",
        body: JSON.stringify(course),
    });
}

export async function apiAddCourse(
    course: Omit<Course, "id">,
): Promise<Course> {
    return await safeApiFetcher<Course>("/api/course", {
        method: "PUT",
        body: JSON.stringify(course),
    });
}

export async function apiDeleteCourse(courseId: CourseId): Promise<void> {
    await safeApiFetcher<void>("/api/course", {
        method: "DELETE",
        body: JSON.stringify(courseId),
    });
}
