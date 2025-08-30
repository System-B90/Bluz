import { getHiveClient } from "@/api-server/hive/client";

export async function getHiveStudents()
{
    const username = process.env.HIVE_USERNAME;
    const password = process.env.HIVE_PASSWORD;

    if (!username || !password)
    {
        throw new Error("HIVE_USERNAME and HIVE_PASSWORD must be defined in environment variables.");
    }

    const hiveClient = await getHiveClient(username, password);
    const students = await hiveClient.getUsers({
        clearance__in: [ 1 ],
    });
    return students;
}
