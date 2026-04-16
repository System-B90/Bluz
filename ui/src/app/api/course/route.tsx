export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { DbCourses } from "@/api-server/db-courses";
import { ClientApiError } from "@/api-shared/errors";
import { Course } from "@/api-shared/types/course";

export async function GET(
    request: NextRequest
)
{
    try
    {
        const data = await DbCourses.get();
        return ApiSuccess(data);
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}

export async function POST(
    request: NextRequest
)
{
    try
    {
        const course: Course = await request.json();
        if (!course) { throw new ClientApiError('No data provided!'); }
        return ApiSuccess(await DbCourses.set(course));
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}

export async function DELETE(
    request: NextRequest
)
{
    try
    {
        const courseId: Course[ 'id' ] = await request.json();
        if (!courseId) { throw new ClientApiError('No courseId provided!'); }
        return ApiSuccess(await DbCourses.del(courseId));
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}

export async function PUT(
    request: NextRequest
)
{
    try
    {
        const course: Course = await request.json();
        if (!course) { throw new ClientApiError('No data provided!'); }
        return ApiSuccess(await DbCourses.create(course));
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
