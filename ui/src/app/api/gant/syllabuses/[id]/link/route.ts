export const dynamic = 'force-dynamic';

import { DbSyllabus } from '@/api-server/gantt/db-syllabus';
import { Syllabus } from '@/api-shared/types/gant/curriculum';
import { buildGantLinkRoutes } from '@/app/api/gant/base-link';

const { POST, DELETE } = buildGantLinkRoutes<Syllabus>({ dbSet: DbSyllabus });
export { DELETE, POST };
