/*
 * Auth session types now live in @system-b90/hive-nextauth; this module
 * remains the app-side import path (`@/api-shared/types/sso`).
 */
export type {
    AuthSessionData,
    AuthSessionUser,
} from "@system-b90/hive-nextauth";
