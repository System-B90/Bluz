export const dynamic = 'force-dynamic';

import { DbSyllabus } from '@/api-server/curriculum/db-syllabus';
import { buildGantItemRoutes } from '@/app/api/gant/base';

const { GET, PATCH, DELETE } = buildGantItemRoutes({ dbSet: DbSyllabus });
export { DELETE, GET, PATCH };
