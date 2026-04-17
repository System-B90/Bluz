export const dynamic = 'force-dynamic';

import { DbDay } from "@/api-server/gantt/db-day";
import { CurriculumDay } from "@/api-shared/types/gant/curriculum";
import { buildGantCollectionRoutes } from "@/app/api/gant/base-collection";

const { GET, POST } = buildGantCollectionRoutes<CurriculumDay>({ dbSet: DbDay });
export { GET, POST };
