export const dynamic = "force-dynamic";

import { DbDay } from "@/api-server/gantt/db-day";
import { GanttDay } from "@/api-shared/types/gantt/models";
import { buildGantCollectionRoutes } from "@/app/api/gantt/base-collection";

const { GET, POST } = buildGantCollectionRoutes<GanttDay>({ dbSet: DbDay });
export { GET, POST };
