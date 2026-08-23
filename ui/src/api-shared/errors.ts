/*
 * Shared error hierarchy now lives in @system-b90/hive-core; this module
 * remains the app-side import path (`@/api-shared/errors`).
 */
import {
    ApiNotImplementedError,
    ClientApiError,
    ClientApiWarning,
    constructErrorFromNetworkMessage as hiveConstructErrorFromNetworkMessage,
    ForbiddenError,
    HiveClientError,
    OperationAborted,
    UserNotLoggedInError,
} from "@system-b90/hive-core";

export {
    ApiNotImplementedError,
    ClientApiError,
    ClientApiWarning,
    ClientError,
    ForbiddenError,
    HiveClientError,
    OperationAborted,
    ServerNetworkError,
    UserNotLoggedInError,
} from "@system-b90/hive-core";

/**
 * Subclasses the network-message factory should reconstruct into, keyed by
 * the `name` the server payload carries. hive-core's own
 * `constructErrorFromNetworkMessage` always builds a base `ClientApiError`,
 * which makes `instanceof UserNotLoggedInError` checks downstream (e.g. the
 * silent-skip in `enqueueApiErrorSnackbar`) permanently dead.
 */
const NETWORK_ERROR_CONSTRUCTORS: Record<
    string,
    new (message?: string) => ClientApiError
> = {
    UserNotLoggedInError,
    ApiNotImplementedError,
    ForbiddenError,
    HiveClientError,
    ClientApiWarning,
    OperationAborted,
};

/**
 * Builds a `ClientApiError` (or the matching named subclass) from a server
 * error payload, so `instanceof` checks against subclasses like
 * `UserNotLoggedInError` work on the reconstructed client-side error.
 */
export function constructErrorFromNetworkMessage(
    networkMessage: ClientApiError,
): ClientApiError {
    const name =
        typeof networkMessage === "object" && networkMessage !== null
            ? (networkMessage as { name?: string }).name
            : undefined;
    const Ctor = name ? NETWORK_ERROR_CONSTRUCTORS[name] : undefined;
    if (Ctor) {
        // hive-core's .d.ts narrows subclass constructors to `message?:
        // string`, but at runtime they forward straight to ClientApiError's
        // constructor, which also accepts the raw payload object (and
        // Object.assign()s its extra fields onto the instance).
        return new Ctor(networkMessage as unknown as string);
    }
    return hiveConstructErrorFromNetworkMessage(networkMessage);
}
