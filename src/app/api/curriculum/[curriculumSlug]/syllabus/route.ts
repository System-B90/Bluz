import { ApiSuccess, catchHandler } from "@/api-server/common";
import { DbCurriculum } from "@/api-server/curriculum/db-curriculum";
import { DbSyllabus } from "@/api-server/curriculum/db-syallbus";
import { Syllabus } from "@/api-shared/types/curriculum";
import { NextRequest } from "next/server";
import { v4 as uuidv4 } from 'uuid';

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
        const syllabusIds = await DbSyllabus.list({ curriculum: curriculumSlug });
        return ApiSuccess(syllabusIds);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}

export async function POST(request: NextRequest, context: RouteContext)
{
    try
    {
        const { curriculumSlug } = await context.params;
        const body: Syllabus = await request.json();
        const payload: Syllabus = { ...body, id: uuidv4() };
        const newSyllabus = await DbSyllabus.create(payload);

        await DbCurriculum.addSyllabus(curriculumSlug, newSyllabus.id);

        return ApiSuccess(newSyllabus);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}
