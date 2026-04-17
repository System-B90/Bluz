export const dynamic = 'force-dynamic';

import { DbModule } from "@/api-server/gantt/db-module";
import { buildGantCollectionRoutes } from "@/app/api/gant/base-collection";

const { GET, POST } = buildGantCollectionRoutes({ dbSet: DbModule });
export { GET, POST };
