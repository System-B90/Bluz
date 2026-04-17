export const dynamic = 'force-dynamic';

import { DbModule } from '@/api-server/gantt/db-module';
import { Module } from '@/api-shared/types/gantt/curriculum';
import { buildGantLinkRoutes } from '@/app/api/gantt/base-link';

const { POST, DELETE } = buildGantLinkRoutes<Module>({ dbSet: DbModule });
export { DELETE, POST };
