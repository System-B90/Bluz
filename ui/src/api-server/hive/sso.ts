import { buildHiveAuthOptions } from "@system-b90/hive-nextauth";

import { Clearance } from "@/api-shared/types/hive";

/*
 * The Hive OIDC provider, callbacks, and logger now live in
 * @system-b90/hive-nextauth (extracted from this file). Defaults match the
 * previous inline config: /login sign-in page, NEXT_PUBLIC_HIVE_URL /
 * HIVE_CLIENT_ID / HIVE_CLIENT_SECRET env wiring.
 *
 * Hanich is allowed in as of the student view (#656). Signing in is *all* it
 * buys: every API route gates on `requireStaffSession()`, the sole exception
 * being `/api/student-view/schedule`, and the post-auth layout bounces a
 * Hanich session to `/student-view` before any staff page renders. Adding a
 * route without `requireStaffSession()` now opens it to students — don't.
 */
export const authOptions = buildHiveAuthOptions({
    allowedClearances: [Clearance.Hanich, Clearance.Segel, Clearance.Admin],
});
