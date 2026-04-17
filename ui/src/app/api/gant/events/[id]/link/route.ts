export const dynamic = 'force-dynamic';

import { DbModuleEvent } from '@/api-server/gantt/db-module-event';
import { ModuleEvent } from '@/api-shared/types/gant/curriculum';
import { buildGantLinkRoutes } from '@/app/api/gant/base-link';

const { POST, DELETE } = buildGantLinkRoutes<ModuleEvent>({ dbSet: DbModuleEvent });
export { DELETE, POST };
