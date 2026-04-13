export const dynamic = 'force-dynamic';

import { DbSyllabus } from '@/api-server/curriculum/db-syllabus';
import { buildGantLinkRoutes } from '@/app/api/gant/base-link';

const { POST, DELETE } = buildGantLinkRoutes({ dbSet: DbSyllabus });
export { POST, DELETE };
