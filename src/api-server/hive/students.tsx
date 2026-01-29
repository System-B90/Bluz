import { getHiveClient } from "@/api-server/hive/client";
import { Clearance } from "@/api-server/hive/types";

export async function getHiveStudents()
{
    const hiveClient = await getHiveClient();
    const students = await hiveClient.getUsers({
        clearance__in: [ Clearance.Hanich, ],
    });
    return students;
}
