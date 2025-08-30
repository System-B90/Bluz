import { safeApiFetcher } from "@/api-client/common";
import { CallStudentToHadasParams, RemoveStudentCallToHadasParams, StudentToHadasData, UpdateStateStudentCallToHadasParams } from "@/api-shared/types";
import { Update } from "next/dist/build/swc/types";


export async function apiGetStudentsCalledToHadas()
{
    const data = (await safeApiFetcher('/api/call-to-hadas'));
    return data as Array<StudentToHadasData>;
}

export async function apiCallStudentToHadas({ ...params }: CallStudentToHadasParams)
{
    await safeApiFetcher('/api/call-to-hadas', {
        method: 'PUT',
        body: JSON.stringify({
            ...params
        })
    });
    return;
}

export async function apiRemoveStudentCallToHadas({ ...params }: RemoveStudentCallToHadasParams)
{
    await safeApiFetcher('/api/call-to-hadas', {
        method: 'DELETE',
        body: JSON.stringify({
            ...params
        })
    });
    return;
}

export async function apiUpdateStateStudentCallToHadas({ ...params }: UpdateStateStudentCallToHadasParams)
{
    await safeApiFetcher('/api/call-to-hadas', {
        method: 'POST',
        body: JSON.stringify({
            ...params
        })
    });
    return;
}
