export const dynamic = 'force-dynamic';

import { DbModule } from "@/api-server/curriculum/db-module";
import { buildGantCollectionRoutes } from "@/app/api/gant/base";

const { GET, POST } = buildGantCollectionRoutes({ dbSet: DbModule });
export { GET, POST };
