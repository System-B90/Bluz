export const dynamic = 'force-dynamic';

import { DbSyllabus } from '@/api-server/gantt/db-syllabus';
import { GanttSyllabus } from '@/api-shared/types/gantt/curriculum';
import { buildGantLinkRoutes } from '@/app/api/gantt/base-link';

const { POST, DELETE } = buildGantLinkRoutes<GanttSyllabus>({ dbSet: DbSyllabus });
export { DELETE, POST };
