import { safeApiFetcher } from "@/api-client/common";
import {
    Iteration,
    IterationId,
    PatchIterationPayload,
    RegisterIterationPayload,
} from "@/api-shared/types/iteration";

export async function apiListIterations(): Promise<Array<Iteration>> {
    return await safeApiFetcher<Array<Iteration>>("/api/iterations", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
}

export async function apiGetCurrentIteration(): Promise<Iteration> {
    return await safeApiFetcher<Iteration>("/api/iterations/current", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
}

export async function apiRegisterIteration(
    payload: RegisterIterationPayload,
): Promise<Iteration> {
    return await safeApiFetcher<Iteration>("/api/iterations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
}

export async function apiPatchIteration(
    id: IterationId,
    patch: PatchIterationPayload,
): Promise<Iteration> {
    return await safeApiFetcher<Iteration>(
        `/api/iterations/${encodeURIComponent(id)}`,
        {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
        },
    );
}
