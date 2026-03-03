import { ApiSuccess, catchHandler } from "@/api-server/common";
import { DbCurriculum } from "@/api-server/curriculum/db-curriculum";
import { NextRequest } from "next/server";
import { v4 as uuidv4 } from 'uuid';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest)
{
    try
    {
        const curriculumIds = await DbCurriculum.list();
        return ApiSuccess(curriculumIds);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}

export async function POST(request: NextRequest)
{
    try
    {
        const body = await request.json();

        const payload = { ...body, id: uuidv4() };
        const newCurriculum = await DbCurriculum.create(payload);

        return ApiSuccess(newCurriculum);
    } catch (error)
    {
        return catchHandler(request, error);
    }
}   
