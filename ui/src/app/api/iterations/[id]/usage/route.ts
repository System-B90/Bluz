export const dynamic = "force-dynamic";

import { ApiSuccess, ServerApiWithParams, withApi } from "@/api-server/common";
import { DbIterations } from "@/api-server/db-iterations";
import { requireStaffSession } from "@/api-server/session-user";
import { IterationUsage } from "@/api-shared/types/iteration";

type ServerApiIterationUsage = ServerApiWithParams<
    void,
    IterationUsage,
    { id: string }
>;

/** What still hangs off this iteration — drives the delete affordance (#473). */
export const GET: ServerApiIterationUsage = withApi(
    async (request, context) => {
        await requireStaffSession();
        const { id } = await context.params;
        return ApiSuccess(await DbIterations.usage(id));
    },
);
