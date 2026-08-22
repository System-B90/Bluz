export const dynamic = "force-dynamic";

import { ApiSuccess, ServerApi, withApi } from "@/api-server/common";
import { DbIterations } from "@/api-server/db-iterations";
import { requireStaffSession } from "@/api-server/session-user";
import { IterationUsage } from "@/api-shared/types/iteration";

type ServerApiCurrentIterationUsage = ServerApi<void, IterationUsage>;

/**
 * The static "current" segment shadows `[id]/usage` for a migrated iteration
 * whose literal id is "current" (see ../route.ts), so that id is served here.
 */
export const GET: ServerApiCurrentIterationUsage = withApi(async () => {
    await requireStaffSession();
    const literal = await DbIterations.get("current");
    const target = literal ?? (await DbIterations.current());
    return ApiSuccess(await DbIterations.usage(target.id));
});
