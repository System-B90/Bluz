export const dynamic = 'force-dynamic';

import { DbCurriculum } from "@/api-server/curriculum/db-curriculum";
import { buildGantCollectionRoutes } from "@/app/api/gant/base-collection";

const { GET, POST } = buildGantCollectionRoutes({ dbSet: DbCurriculum });
export { GET, POST };
