/**
 * Name: cli-handoff.ts
 * Purpose: Shared type for the CLI login handoff — a single-use, short-TTL
 *          code that stands in for the raw session token while it crosses
 *          the browser -> loopback CLI server -> Bluz server round trip.
 * Created: 2026-08-22
 * Author: Michael K. Steinberg
 */

/**
 * One outstanding CLI login handoff. `code` is the lookup key (opaque,
 * crypto.randomBytes-derived — never the verification code shown on screen,
 * which only guards the loopback callback, see #521). `sealedToken` is the
 * next-auth session token encrypted at rest with `secret-box.ts` — never
 * stored in the clear.
 *
 * Redemption (`POST /api/cli-auth/redeem`) is a `findOneAndDelete` by `code`,
 * which is what makes the code single-use: the delete *is* the "already
 * redeemed" guard, the same insert/delete-as-claim pattern as
 * `CurriculumCutClaim` and `HiveLessonActivation`. `createdAt` backs a Mongo
 * TTL index as a backstop for codes nobody redeems; redemption also checks
 * the age itself so expiry is enforced immediately rather than only at the
 * next TTL sweep (which runs on a ~60s cadence).
 */
export type CliHandoffCode = {
    code: string;
    sealedToken: string;
    userId: string;
    createdAt: Date;
};

/** How long a handoff code is redeemable for. Kept short: the whole login
 * round trip (page load, loopback fetch/navigation, CLI's HTTPS redeem call)
 * normally completes in a few seconds. */
export const CLI_HANDOFF_TTL_SECONDS = 120;
