export const dynamic = 'force-dynamic';

import { DbModuleEvent } from '@/api-server/curriculum/db-module-event';
import { buildGantAllocateTimeRoutes } from '@/app/api/gant/base-allocate-time';

const { POST, GET } = buildGantAllocateTimeRoutes({ dbSet: DbModuleEvent });
export { POST, GET };
