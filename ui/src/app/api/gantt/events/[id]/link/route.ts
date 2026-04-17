export const dynamic = 'force-dynamic';

import { DbModuleEvent } from '@/api-server/gantt/db-module-event';
import { GanttEvent } from '@/api-shared/types/gantt/curriculum';
import { buildGantLinkRoutes } from '@/app/api/gantt/base-link';

const { POST, DELETE } = buildGantLinkRoutes<GanttEvent>({ dbSet: DbModuleEvent });
export { DELETE, POST };

