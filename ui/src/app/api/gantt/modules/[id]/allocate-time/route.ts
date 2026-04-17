export const dynamic = 'force-dynamic';

import { DbModule } from '@/api-server/gantt/db-module';
import { buildGantAllocateTimeRoutes } from '@/app/api/gantt/base-allocate-time';

const { POST, GET } = buildGantAllocateTimeRoutes({ dbSet: DbModule });
export { GET, POST };

