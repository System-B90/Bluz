export const dynamic = 'force-dynamic';

import { DbModule } from '@/api-server/gantt/db-module';
import { GanttModule } from '@/api-shared/types/gantt/curriculum';
import { buildGantLinkRoutes } from '@/app/api/gantt/base-link';

const { POST, DELETE } = buildGantLinkRoutes<GanttModule>({ dbSet: DbModule });
export { DELETE, POST };
