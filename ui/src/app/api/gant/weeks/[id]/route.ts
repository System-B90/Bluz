export const dynamic = 'force-dynamic';

import { DbWeek } from '@/api-server/gantt/db-week';
import { buildGantItemRoutes } from '@/app/api/gant/base-item';

const { GET, PATCH, DELETE } = buildGantItemRoutes({ dbSet: DbWeek });
export { DELETE, GET, PATCH };
