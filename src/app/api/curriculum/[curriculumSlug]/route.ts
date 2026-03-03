import { ApiSuccess, catchHandler } from "@/api-server/common";
import { DbCurriculum } from "@/api-server/curriculum/db-curriculum";
import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';

interface RouteContext
{
    params: Promise<{ curriculumSlug: string; }>;
}

export async function GET(request: NextRequest, context: RouteContext)
{
    try
    {
        const { curriculumSlug } = await context.params;
        const curriculum = await DbCurriculum.get(curriculumSlug);
        console.log(curriculumSlug, curriculum);
        return ApiSuccess(curriculum);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}

export async function PATCH(request: NextRequest, context: RouteContext)
{
    try
    {
        const { curriculumSlug } = await context.params;
        const body = await request.json();

        const updatedCurriculum = await DbCurriculum.update(curriculumSlug, body);

        return ApiSuccess(updatedCurriculum);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}

export async function DELETE(request: NextRequest, context: RouteContext)
{
    try
    {
        const { curriculumSlug } = await context.params;

        await DbCurriculum.delete(curriculumSlug);

        return ApiSuccess({ deleted: true, id: curriculumSlug });
    } catch (error)
    {
        return catchHandler(request, error);
    }
}
