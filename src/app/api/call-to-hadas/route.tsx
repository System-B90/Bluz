export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler } from "@/api-server/common";
import { addStudentCalledToHadas, getStudentsCalledToHadas, removeStudentCalledToHadas, updateStateStudentCallToHadas } from "@/api-server/datastore";
import { SendServerRequestToSessionServer } from "@/api-server/web-socket-utils";
import { CallStudentToHadasParams, RemoveStudentCallToHadasParams, UpdateStateStudentCallToHadasParams } from "@/api-shared/types";
import { MessageTypes } from "@/settings";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest
)
{
    try
    {
        return ApiSuccess(await getStudentsCalledToHadas());
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
        const data: CallStudentToHadasParams = await request.json();

        data.studentNames.forEach((v) => addStudentCalledToHadas(v, data.reason, data.expirationTime));

        return ApiSuccess(
            `החניכים ${data.studentNames} נקראו לחד"ס`
        );
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
        const data: RemoveStudentCallToHadasParams = await request.json();

        removeStudentCalledToHadas(data.studentName);

        return ApiSuccess(
            `סומן ש-${data.studentName} הגיע לחד"ס`
        );
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
        const data: UpdateStateStudentCallToHadasParams = await request.json();

        updateStateStudentCallToHadas(data.studentName, data.state);

        return ApiSuccess(
            `הוחלף מצב החניך ${data.studentName} ל-${data.state}`
        );
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
