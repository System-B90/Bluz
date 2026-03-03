import { ApiSuccess, catchHandler } from "@/api-server/common";
import { DbCurriculum } from "@/api-server/curriculum/db-curriculum";
import { DbModule } from "@/api-server/curriculum/db-module";
import { DbSyllabus, DbSyllabusDocument } from "@/api-server/curriculum/db-syallbus";
import { ClientApiError } from "@/api-shared/errors";
import { CurriculumId, Module, Syllabus, SyllabusId } from "@/api-shared/types/curriculum";
import { NextRequest } from "next/server";
import { v4 as uuidv4 } from 'uuid';

export const dynamic = 'force-dynamic';

interface RouteContext
{
    params: Promise<{ curriculumSlug: CurriculumId; syllabusSlug: SyllabusId; }>;
}

export async function GET(request: NextRequest, context: RouteContext)
{
    try
    {
        const { syllabusSlug } = await context.params;
        const syllabus: Pick<DbSyllabusDocument, 'modules'> | null = await DbSyllabus.get(syllabusSlug, { 'projection': { 'modules': true, '_id': false } });
        if (!syllabus) { throw new ClientApiError(`Syllabus by id ${syllabusSlug} not found!`); }
        return ApiSuccess(syllabus.modules);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}

export async function POST(request: NextRequest, context: RouteContext)
{
    try
    {
        const { syllabusSlug } = await context.params;
        const body: Module = await request.json();
        const payload: Module = { ...body, id: uuidv4() };
        const newModule = await DbModule.create(payload);

        await DbSyllabus.addModule(syllabusSlug, newModule.id);

        return ApiSuccess(newModule);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}
