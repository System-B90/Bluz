import { createHiveClient } from "@/api-server/hive/session-client";
import { Clearance } from "@/api-server/hive/types";

export async function getHiveStudents() {
  const hiveClient = await createHiveClient();
  const students = await hiveClient.getUsers({
    clearance__in: [Clearance.Hanich],
  });
  return students;
}
