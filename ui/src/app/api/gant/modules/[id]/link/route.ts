export const dynamic = 'force-dynamic';

import { DbModule } from '@/api-server/curriculum/db-module';
import { buildGantLinkRoutes } from '@/app/api/gant/base-link';

const { POST, DELETE } = buildGantLinkRoutes({ dbSet: DbModule });
export { POST, DELETE };
