/*
 * Shared error hierarchy now lives in @system-b90/hive-core; this module
 * remains the app-side import path (`@/api-shared/errors`).
 */
export {
    ApiNotImplementedError,
    ClientApiError,
    ClientApiWarning,
    ClientError,
    constructErrorFromNetworkMessage,
    ForbiddenError,
    HiveClientError,
    OperationAborted,
    ServerNetworkError,
    UserNotLoggedInError,
} from "@system-b90/hive-core";
