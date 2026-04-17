export const dynamic = 'force-dynamic';

import { DbSyllabus } from "@/api-server/gantt/db-syllabus";
import { buildGantCollectionRoutes } from "@/app/api/gantt/base-collection";

const { GET, POST } = buildGantCollectionRoutes({ dbSet: DbSyllabus });
export { GET, POST };
