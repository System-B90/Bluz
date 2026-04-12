import { safeApiFetcher } from "@/api-client/common";
import { Course, CourseId } from "@/api-shared/types/course";

export async function apiGetCourses(): Promise<Array<Course>>
{
    return (await safeApiFetcher('/api/course')) as Array<Course>;
}

export async function apiSetCourse(course: Course): Promise<Course>
{
    return (await safeApiFetcher('/api/course', {
        method: 'POST',
        body: JSON.stringify(course),
    })) as Course;
}

export async function apiAddCourse(course: Omit<Course, 'id'>): Promise<Course>
{
    return (await safeApiFetcher('/api/course', {
        method: 'PUT',
        body: JSON.stringify(course),
    })) as Course;
}

export async function apiDeleteCourse(courseId: CourseId): Promise<void>
{
    await safeApiFetcher('/api/course', {
        method: 'DELETE',
        body: JSON.stringify({ id: courseId }),
    });
}
