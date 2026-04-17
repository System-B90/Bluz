export const dynamic = 'force-dynamic';

import { DbDay } from '@/api-server/gantt/db-day';
import { CurriculumDay } from '@/api-shared/types/gant/curriculum';
import { buildGantItemRoutes } from '@/app/api/gant/base-item';

const { GET, PATCH, DELETE } = buildGantItemRoutes<CurriculumDay>({ dbSet: DbDay });
export { DELETE, GET, PATCH };
