import { ApiSuccess, catchHandler } from "@/api-server/common";
import { ClearanceEnum, CourseUser, GenderEnum, StatusEnum } from "@/api-server/hive/types";
import { NextRequest } from "next/server";

export async function GET(
    request: NextRequest,
)
{
    try
    {
        const users: Array<Partial<CourseUser>> = [
            {
                id: 1,
                username: "bis-hanich-1",
                first_name: "ישראל",
                last_name: "ישראלי",
                display_name: "1 - ישראל ישראלי",
                clearance: ClearanceEnum.NUMBER_1,
                gender: GenderEnum.Male,
                status: StatusEnum.Present,
                status_date: new Date().toISOString(),
                current_assignment: null,
                current_assignment_options: [],
                mentees: [],
                classes: [ 1 ],
            },
            {
                id: 3,
                username: "bis-michaelks",
                first_name: "מיכאל",
                last_name: "שטיינברג",
                display_name: "מיכאל שטיינברג",
                clearance: ClearanceEnum.NUMBER_3, // Segel
                gender: GenderEnum.Male,
                mentees: [],
            },
            {
                id: 4,
                username: "bis-yuvalb",
                first_name: "יובל",
                last_name: "ברוורמן",
                display_name: "יובל ברוורמן",
                clearance: ClearanceEnum.NUMBER_3, // Segel
                gender: GenderEnum.Female,
                mentees: [],
            },
            {
                id: 5,
                username: "bis-yonatanr",
                first_name: "יונתן",
                last_name: "רונן",
                display_name: "יונתן רונן",
                clearance: ClearanceEnum.NUMBER_3, // Segel
                gender: GenderEnum.Male,
                mentees: [],
            },
        ];

        return ApiSuccess(users);
    }
    catch (e)
    {
        return catchHandler(request, e);
    };
}
