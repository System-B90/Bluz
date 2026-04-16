export const dynamic = 'force-dynamic';

import { DbDay } from "@/api-server/curriculum/db-day";
import { buildGantCollectionRoutes } from "@/app/api/gant/base-collection";

const { GET, POST } = buildGantCollectionRoutes({ dbSet: DbDay });
export { GET, POST };

