export const dynamic = 'force-dynamic';

import { DbSyllabus } from "@/api-server/curriculum/db-syallbus";
import { buildGantCollectionRoutes } from "@/app/api/gant/base";

const { GET, POST } = buildGantCollectionRoutes({ dbSet: DbSyllabus });
export { GET, POST };
