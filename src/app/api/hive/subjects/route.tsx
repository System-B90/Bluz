import { ApiSuccess, catchHandler } from "@/api-server/common";
import { Subject } from "@/components/schedule/types/subject";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest,
)
{
    try
    {
        const subjects: Subject[] = [
            {
                id: "1",
                name: "מערכות הפעלה",
                color: "#FF5733",
                displayName: 'ס'
            },
            {
                id: "2",
                name: "מחקר",
                color: "#33FF57",
                displayName: 'ח'
            },
            {
                id: "3",
                name: "פייתון",
                color: "#3357FF",
                displayName: 'נ'
            },
        ];

        return ApiSuccess(subjects);
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
