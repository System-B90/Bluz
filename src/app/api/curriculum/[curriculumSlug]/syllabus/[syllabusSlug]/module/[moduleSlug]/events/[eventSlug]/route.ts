import { ApiSuccess, catchHandler } from "@/api-server/common";
import { DbModuleEvent } from "@/api-server/curriculum/db-module-event";
import { CurriculumId, ModuleEventId, ModuleId, SyllabusId } from "@/api-shared/types/curriculum";
import { NextRequest } from "next/server";

export const dynamic = 'force-dynamic';

interface RouteContext
{
    params: Promise<{ curriculumSlug: CurriculumId; syllabusSlug: SyllabusId; moduleSlug: ModuleId; eventSlug: ModuleEventId; }>;
}

export async function GET(request: NextRequest, context: RouteContext)
{
    try
    {
        const { eventSlug } = await context.params;
        const moduleEvent = await DbModuleEvent.get(eventSlug);

        return ApiSuccess(moduleEvent);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}

export async function PATCH(request: NextRequest, context: RouteContext)
{
    try
    {
        const { eventSlug } = await context.params;
        const body = await request.json();

        const updatedModuleEvent = await DbModuleEvent.update(eventSlug, body);

        return ApiSuccess(updatedModuleEvent);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}

export async function DELETE(request: NextRequest, context: RouteContext)
{
    try
    {
        const { eventSlug } = await context.params;

        await DbModuleEvent.delete(eventSlug);

        return ApiSuccess();
    } catch (error)
    {
        return catchHandler(request, error);
    }
}
