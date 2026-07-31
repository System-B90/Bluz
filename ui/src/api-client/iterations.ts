import { safeApiFetcher } from "@/api-client/common";
import {
    Iteration,
    IterationId,
    PatchIterationPayload,
    RegisterIterationPayload,
    SyncHiveResult,
} from "@/api-shared/types/iteration";

export async function apiListIterations(): Promise<Array<Iteration>> {
    return await safeApiFetcher<Array<Iteration>>("/api/iterations", {
        method: "GET",
    });
}

export async function apiGetCurrentIteration(): Promise<Iteration> {
    return await safeApiFetcher<Iteration>("/api/iterations/current", {
        method: "GET",
    });
}

export async function apiRegisterIteration(
    payload: RegisterIterationPayload,
): Promise<Iteration> {
    return await safeApiFetcher<Iteration>("/api/iterations", {
        method: "POST",
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
            body: JSON.stringify(patch),
        },
    );
}

export async function apiSyncIterationHive(
    id: IterationId,
): Promise<SyncHiveResult> {
    return await safeApiFetcher<SyncHiveResult>(
        `/api/iterations/${encodeURIComponent(id)}/sync-hive`,
        { method: "POST" },
    );
}
