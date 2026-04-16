export const dynamic = 'force-dynamic';

import { DbDay } from '@/api-server/curriculum/db-day';
import { buildGantItemRoutes } from '@/app/api/gant/base-item';

const { GET, PATCH, DELETE } = buildGantItemRoutes({ dbSet: DbDay });
export { DELETE, GET, PATCH };

