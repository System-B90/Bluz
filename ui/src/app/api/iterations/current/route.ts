export const dynamic = "force-dynamic";

import { ApiSuccess, catchHandler, ServerApi } from "@/api-server/common";
import { DbIterations } from "@/api-server/db-iterations";
import { Iteration } from "@/api-shared/types/iteration";

type ServerApiCurrentIteration = ServerApi<void, Iteration>;

export const GET: ServerApiCurrentIteration = async (request) => {
    try {
        return ApiSuccess(await DbIterations.current());
    } catch (e) {
        return catchHandler(request, e);
    }
};
