import { ApiSuccess, catchHandler } from "@/api-server/common";
import { DbCurriculum } from "@/api-server/curriculum/db-curriculum";
import { DbSyllabus } from "@/api-server/curriculum/db-syallbus";
import { Syllabus } from "@/api-shared/types/curriculum";
import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';

interface RouteContext
{
    params: Promise<{ curriculumSlug: string; syllabusSlug: string; }>;
}

export async function GET(request: NextRequest, context: RouteContext)
{
    try
    {
        const { syllabusSlug } = await context.params;
        const curriculum = await DbSyllabus.get(syllabusSlug);

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
        const { syllabusSlug } = await context.params;
        const body = await request.json();

        const updatedCurriculum = await DbSyllabus.update(syllabusSlug, body);

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
        const { curriculumSlug, syllabusSlug } = await context.params;


        await DbCurriculum.removeSyllabus(curriculumSlug, syllabusSlug);

        // Check if this module is used in other syllabus
        if (await DbCurriculum.countByFilter({ id: { '$ne': curriculumSlug }, syllabuses: syllabusSlug }) === 0)
        {
            // There are no other syllabuses using this module
            await DbSyllabus.delete(syllabusSlug);
        }

        return ApiSuccess();
    } catch (error)
    {
        return catchHandler(request, error);
    }
}
