export const dynamic = 'force-dynamic';

import { DbModuleEvent } from '@/api-server/curriculum/db-module-event';
import { buildGantLinkRoutes } from '@/app/api/gant/base-link';

const { POST, DELETE } = buildGantLinkRoutes({ dbSet: DbModuleEvent });
export { POST, DELETE };
