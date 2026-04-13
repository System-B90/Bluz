export const dynamic = 'force-dynamic';

import { DbModuleEvent } from "@/api-server/curriculum/db-module-event";
import { buildGantCollectionRoutes } from "@/app/api/gant/base-collection";

const { GET, POST } = buildGantCollectionRoutes({ dbSet: DbModuleEvent });
export { GET, POST };
