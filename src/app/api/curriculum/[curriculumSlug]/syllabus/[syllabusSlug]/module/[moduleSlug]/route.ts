import { ApiSuccess, catchHandler } from "@/api-server/common";
import { DbModule } from "@/api-server/curriculum/db-module";
import { DbSyllabus } from "@/api-server/curriculum/db-syallbus";
import { CurriculumId, ModuleId, SyllabusId } from "@/api-shared/types/curriculum";
import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';

interface RouteContext
{
    params: Promise<{ curriculumSlug: CurriculumId; syllabusSlug: SyllabusId; moduleSlug: ModuleId; }>;
}

export async function GET(request: NextRequest, context: RouteContext)
{
    try
    {
        const { moduleSlug } = await context.params;
        const curriculum = await DbModule.get(moduleSlug);

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
        const { moduleSlug } = await context.params;
        const body = await request.json();

        const updatedCurriculum = await DbModule.update(moduleSlug, body);

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
        const { syllabusSlug, moduleSlug } = await context.params;

        await DbSyllabus.removeModule(syllabusSlug, moduleSlug);

        // Check if this module is used in other syllabus
        if (await DbSyllabus.countByFilter({ id: { '$ne': syllabusSlug }, modules: moduleSlug }) === 0)
        {
            // There are no other syllabuses using this module
            await DbModule.delete(moduleSlug);
        }

        return ApiSuccess();
    } catch (error)
    {
        return catchHandler(request, error);
    }
}
