/**
 * Name: db-cli-handoff.ts
 * Purpose: Mint and redeem CLI login handoff codes (#520). The browser hands
 *          the CLI a single-use code instead of the raw session token; the
 *          CLI redeems it here, over HTTPS, exactly once.
 * Created: 2026-08-22
 * Author: Michael K. Steinberg
 */

import { randomBytes } from "crypto";

import { getMetaController } from "@/api-server/mongo-db-controller";
import { openSecret, sealSecret } from "@/api-server/secret-box";
import { ClientApiError } from "@/api-shared/errors";
import {
    CLI_HANDOFF_TTL_SECONDS,
    CliHandoffCode,
} from "@/api-shared/types/cli-handoff";

// 24 bytes of crypto.randomBytes (192 bits) base64url-encoded — guessing this
// is not a realistic attack even without the rate limit below.
const CODE_BYTES = 24;

function generateCode(): string {
    return randomBytes(CODE_BYTES).toString("base64url");
}

/**
 * Mint a handoff code bound to `userId`, sealing `sessionToken` at rest
 * (secret-box.ts) rather than storing it in the clear.
 *
 * @returns The opaque handoff code to hand the browser (never the token).
 */
async function createHandoffCode(
    sessionToken: string,
    userId: string,
): Promise<string> {
    const code = generateCode();
    const doc: CliHandoffCode = {
        code,
        sealedToken: sealSecret(sessionToken),
        userId,
        createdAt: new Date(),
    };
    await getMetaController().cliHandoffCodes.insertOne(doc);
    return code;
}

/**
 * Redeem a handoff code for its session token exactly once.
 *
 * `findOneAndDelete` makes the delete *and* the lookup a single atomic step:
 * a second, concurrent redemption of the same code loses the race and finds
 * nothing, so "already redeemed" and "unknown code" are indistinguishable by
 * design (no oracle for guessing). Expiry is checked against `createdAt`
 * directly rather than relying solely on the Mongo TTL index, which only
 * sweeps on a ~60s cadence — without this a code could be redeemed well past
 * its nominal TTL.
 *
 * @throws ClientApiError when the code is unknown, already used, or expired.
 */
async function redeemHandoffCode(code: string): Promise<string> {
    const found = await getMetaController().cliHandoffCodes.findOneAndDelete({
        code,
    });
    if (!found) {
        throw new ClientApiError("Invalid or already-used code.");
    }
    const ageSeconds = (Date.now() - found.createdAt.getTime()) / 1000;
    if (ageSeconds > CLI_HANDOFF_TTL_SECONDS) {
        throw new ClientApiError("Code has expired.");
    }
    return openSecret(found.sealedToken);
}

export namespace DbCliHandoff {
    export const create = createHandoffCode;
    export const redeem = redeemHandoffCode;
}
