/*
 * Shared error hierarchy now lives in @system-b15/hive-core; this module
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
} from "@system-b15/hive-core";
