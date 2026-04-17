export const dynamic = 'force-dynamic';

import { DbModuleEvent } from '@/api-server/gantt/db-module-event';
import { buildGantAllocateTimeRoutes } from '@/app/api/gantt/base-allocate-time';

const { POST, GET } = buildGantAllocateTimeRoutes({ dbSet: DbModuleEvent });
export { GET, POST };
