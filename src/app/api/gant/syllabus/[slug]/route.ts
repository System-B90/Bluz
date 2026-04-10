export const dynamic = 'force-dynamic';

import { DbSyllabus } from "@/api-server/curriculum/db-syallbus";
import { buildGantItemRoutes } from "@/app/api/gant/base";

const { GET, PATCH, DELETE } = buildGantItemRoutes({ dbSet: DbSyllabus });
export { GET, PATCH, DELETE };
