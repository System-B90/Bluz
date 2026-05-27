import { AuthOptions, CallbacksOptions, Profile } from "next-auth";
import { OAuthConfig } from "next-auth/providers/index";

import { Clearance, GenderEnum } from "@/api-server/hive/types";
import { AuthSessionData } from "@/api-shared/types/sso";

type JwtTokenData = {
  user: HiveUser;
  accessToken: string;
  refreshToken: string;
  expires_at: number;
};
type HiveSsoProfile = {
  sub: string;
  aud: string;
  iat: number;
  at_hash: string;
  preferred_username: string;
  gender: GenderEnum;
  given_name: string;
  family_name: string;
  picture?: null | string;
  number: null | number;
  clearance: number;
  program: null | number;
  program_name: null | string;
  is_teacher: boolean;
  username: string;
  display_name: string;
  mentor: null | number;
  email?: string;
  iss: string;
  exp: number;
  auth_time: number;
  jti: string;
  api_token?: {
    access_token: string;
    refresh_token: string;
    expires_at: number;
  };
} & Profile;
type HiveUser = {
  id: string;
  name: string;
  email: null | string;
  username: string;
  clearance: number;
  program: null | number;
  gender: GenderEnum;
  display_name: string;
  is_teacher: boolean;
  temp_access_token?: string;
  temp_refresh_token?: string;
  temp_expires_at?: number;
};

const NEXT_PUBLIC_HIVE_URL = process.env.NEXT_PUBLIC_HIVE_URL ?? "";
const HIVE_PROVIDER: OAuthConfig<HiveSsoProfile> = {
    id: "hive",
    name: "Hive",
    type: "oauth",
    checks: ["pkce", "state"],

    // Force NextAuth to send credentials in the request body
    client: {
        token_endpoint_auth_method: "client_secret_post",
    },

    issuer: `${NEXT_PUBLIC_HIVE_URL}/api/core/sso`,
    wellKnown: `${NEXT_PUBLIC_HIVE_URL}/api/core/sso/.well-known/openid-configuration`,

    authorization: {
        params: { scope: `openid profile clearance extended_profile api` },
    },

    clientId: process.env.HIVE_CLIENT_ID,
    clientSecret: process.env.HIVE_CLIENT_SECRET,

    profile(profile) {
        return {
            id: profile.sub.toString(),
            name: `${profile.given_name} ${profile.family_name}`,
            email: profile.email ?? null,
            username: profile.username,
            clearance: profile.clearance,
            program: profile.program,
            gender: profile.gender,
            display_name: profile.display_name,
            is_teacher: profile.is_teacher,
        };
    },
};
const signInCallback: CallbacksOptions["signIn"] = async ({ user }) => {
    const hiveUser = user as HiveUser;

    const isAuthorized =
    hiveUser.clearance === Clearance.Segel ||
    hiveUser.clearance === Clearance.Admin;

    if (!isAuthorized) {
        return false;
    }

    return true;
};

const jwtCallback: CallbacksOptions["jwt"] = async ({
    token,
    user,
    account,
}) => {
    // account is only defined during the very first sign-in step
    if (user && account) {
        const hiveUser = user as HiveUser;

        try {
            // Exchange the opaque DOT token for a SimpleJWT pair
            const exchangeResponse = await fetch(
                `${NEXT_PUBLIC_HIVE_URL.replace(/\/$/, "")}/api/core/sso/exchange/`,
                {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${account.access_token}`,
                        "Content-Type": "application/json",
                    },
                },
            );

            if (!exchangeResponse.ok) {
                throw new Error(
                    `Token exchange failed with status: ${exchangeResponse.status}`,
                );
            }

            const jwtData = await exchangeResponse.json();

            const extraData: JwtTokenData = {
                user: {
                    id: hiveUser.id,
                    name: hiveUser.name,
                    email: hiveUser.email,
                    username: hiveUser.username,
                    clearance: hiveUser.clearance,
                    program: hiveUser.program,
                    gender: hiveUser.gender,
                    display_name: hiveUser.display_name,
                    is_teacher: hiveUser.is_teacher,
                },
                // Use the returned SimpleJWT data
                expires_at: jwtData.expires_at,
                accessToken: jwtData.access_token,
                refreshToken: jwtData.refresh_token,
            };
            token.data = extraData;
        } catch (error) {
            console.error("SSO Token Exchange Error:", error);
            // If exchange fails, you must decide whether to reject the token entirely
            // or return a token with empty access flags to force a re-login.
            throw new Error("Authentication failed during token exchange.");
        }
    }

    return token;
};

const sessionCallback: CallbacksOptions["session"] = async ({
    session,
    token,
}) => {
    if (token && token.data) {
        const authSessionData: AuthSessionData = session as AuthSessionData;
        const tokenData = token.data as JwtTokenData;

        authSessionData.user = tokenData.user;
        authSessionData.accessToken = tokenData.accessToken;

        session = authSessionData;
    }
    return session;
};

export const authOptions: AuthOptions = {
    debug: true,
    // 2. Override the logger to intercept metadata
    logger: {
        error(code, metadata) {
            console.error(`\n❌ [NextAuth Error]: ${code}`);
            console.error(JSON.stringify(metadata, null, 2));
            console.error(`Hive URL: ${NEXT_PUBLIC_HIVE_URL}`);
        },
        warn(code) {
            console.warn(`\n⚠️ [NextAuth Warning]: ${code}`);
        },
        debug(code, metadata) {
            console.log(`\n🐛 [NextAuth Debug]: ${code}`);
            console.log(JSON.stringify(metadata, null, 2));
        },
    },

    providers: [HIVE_PROVIDER],
    pages: {
        signIn: "/login",
    },
    callbacks: {
        signIn: signInCallback,
        jwt: jwtCallback,
        session: sessionCallback,
    },
};
