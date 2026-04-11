export * from "@/session-common";

const SECONDS_IN_AN_HOUR = 3600;
const HOURS_IN_A_DAY = 24;
const SECONDS_IN_A_DAY = SECONDS_IN_AN_HOUR * HOURS_IN_A_DAY;
const DAYS_IN_A_WEEK = 7;

export const USER_AUTH_COOKIE_NAME = 'auth';
// HTTP Caching
export const CACHE_CONTROL_HTTP_HEADER = 'Cache-Control';
export const IMMUTABLE_CACHE_MAX_TTL = SECONDS_IN_A_DAY * DAYS_IN_A_WEEK * 4; // 28 days


export function getJwtSecret()
{
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret)
    {
        throw new Error("JWT_SECRET environment variable has not been set!");
    }
    return jwtSecret;
}

let _encryptionKey: CryptoKey | null = null;
export async function getSymetricalEncyptionKey()
{
    if (null === _encryptionKey)
    {
        const symEncKey = process.env.SYM_ENC_KEY;
        if (!symEncKey)
        {
            throw new Error("SYM_ENC_KEY environment variable has not been set!");
        }
        _encryptionKey = await crypto.subtle.importKey(
            'raw',
            Buffer.from(symEncKey, 'base64'),
            { name: 'AES-GCM', length: 256 },
            true,
            [ 'encrypt', 'decrypt' ]
        );
    }
    return _encryptionKey;
}
