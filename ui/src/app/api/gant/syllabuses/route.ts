export const dynamic = 'force-dynamic';

import { DbSyllabus } from "@/api-server/curriculum/db-syllabus";
import { buildGantCollectionRoutes } from "@/app/api/gant/base-collection";

const { GET, POST } = buildGantCollectionRoutes({ dbSet: DbSyllabus });
export { GET, POST };
