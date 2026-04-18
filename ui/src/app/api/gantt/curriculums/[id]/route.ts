import { DbCurriculum } from "@/api-server/gantt/db-curriculum";
import { buildGantItemRoutes } from "@/app/api/gantt/base-item";

const { GET, PATCH, DELETE } = buildGantItemRoutes({ dbSet: DbCurriculum });
export { DELETE, GET, PATCH };
