import { DbCurriculum } from '@/api-server/gantt/db-curriculum';
import { buildGantItemRoutes } from "@/app/api/gant/base-item";

const { GET, PATCH, DELETE } = buildGantItemRoutes({ dbSet: DbCurriculum });
export { DELETE, GET, PATCH };
