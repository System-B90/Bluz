export const dynamic = 'force-dynamic';

import { DbCurriculum } from "@/api-server/curriculum/db-curriculum";
import { buildGantItemRoutes } from "@/app/api/gant/base";

const { GET, PATCH, DELETE } = buildGantItemRoutes({ dbSet: DbCurriculum });
export { GET, PATCH, DELETE };
