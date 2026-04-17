export const dynamic = 'force-dynamic';

import { DbSyllabus } from '@/api-server/gantt/db-syllabus';
import { buildGantItemRoutes } from '@/app/api/gantt/base-item';

const { GET, PATCH, DELETE } = buildGantItemRoutes({ dbSet: DbSyllabus });
export { DELETE, GET, PATCH };

