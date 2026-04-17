export const dynamic = 'force-dynamic';

import { DbDay } from '@/api-server/gantt/db-day';
import { GanttDay } from '@/api-shared/types/gantt/curriculum';
import { buildGantItemRoutes } from '@/app/api/gantt/base-item';

const { GET, PATCH, DELETE } = buildGantItemRoutes<GanttDay>({ dbSet: DbDay });
export { DELETE, GET, PATCH };

