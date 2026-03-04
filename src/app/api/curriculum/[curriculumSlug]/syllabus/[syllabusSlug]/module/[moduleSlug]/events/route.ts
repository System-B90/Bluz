import { ApiSuccess, catchHandler } from "@/api-server/common";
import { BaseDbDocument, DbCurriculum } from "@/api-server/curriculum/db-curriculum";
import { DbModule } from "@/api-server/curriculum/db-module";
import { DbModuleEvent } from "@/api-server/curriculum/db-module-event";
import { DbSyllabus, DbSyllabusDocument } from "@/api-server/curriculum/db-syallbus";
import { ClientApiError } from "@/api-shared/errors";
import { CurriculumId, Module, ModuleEvent, ModuleEventId, ModuleId, Syllabus, SyllabusId } from "@/api-shared/types/curriculum";
import { NextRequest } from "next/server";
import { v4 as uuidv4 } from 'uuid';

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
        const module: Pick<Module & BaseDbDocument, 'events'> | null = await DbModule.get(moduleSlug, { 'projection': { 'events': true, '_id': false } });
        if (!module) { throw new ClientApiError(`Module by id ${moduleSlug} not found!`); }
        return ApiSuccess(module.events);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}

export async function POST(request: NextRequest, context: RouteContext)
{
    try
    {
        const { moduleSlug } = await context.params;
        const body: ModuleEvent = await request.json();
        const payload: ModuleEvent = { ...body, id: uuidv4() };
        const newModuleEvent = await DbModuleEvent.create(payload);

        await DbModule.addEvent(moduleSlug, newModuleEvent.id);

        return ApiSuccess(newModuleEvent);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}
