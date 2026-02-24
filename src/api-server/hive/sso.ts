import { AuthSessionData } from "@/api-shared/types/sso";
import { Account, AuthOptions, CallbacksOptions, Profile } from "next-auth";
import { OAuthConfig, Provider } from "next-auth/providers/index";

interface HiveSsoProfile extends Profile
{
    sub: string;
    aud: string,
    iat: number,
    at_hash: string,
    preferred_username: string,
    gender: 'NonBinary' | 'Male' | 'Female',
    given_name: string,
    family_name: string,
    picture: undefined,
    number: number | null,
    clearance: 5,
    program: number | null,
    program_name: string | null,
    is_teacher: boolean,
    username: string,
    display_name: string,
    mentor: number | null,
    api_token: string,
    iss: string,
    exp: number,
    auth_time: number,
    jti: string,
}

interface HiveAccount extends Account
{
    provider: 'hive',
    type: 'oauth',
    providerAccountId: string,
    access_token: string,
    expires_at: number,
    token_type: 'Bearer',
    scope: 'openid profile clearance extended_profile',
    refresh_token: string,
    id_token: string;
}

interface HiveUser
{
    id: string;
    name: string;
    email: undefined;
    username: string;
    clearance: 5;
    program: number | null;
    gender: 'NonBinary';
    display_name: string;
    is_teacher: boolean;
    accessToken: string;
}
const HIVE_PROVIDER: OAuthConfig<HiveSsoProfile> = {
    id: "hive",
    name: "Hive",
    type: "oauth",

    checks: [ "pkce", "state" ],

    // Force NextAuth to send credentials in the request body
    client: {
        token_endpoint_auth_method: "client_secret_post",
    },

    issuer: "https://hive.org/sso/",
    // wellKnown: "https://hive.org/sso/.well-known/openid-configuration",
    jwks_endpoint: 'https://hive.org/sso/.well-known/jwks.json',

    authorization: {
        url: "https://hive.org/sso/authorize/",
        params: { scope: "openid profile clearance extended_profile api" }
    },

    token: "https://hive.org/sso/token/",
    userinfo: "https://hive.org/sso/userinfo/",

    clientId: process.env.HIVE_CLIENT_ID,
    clientSecret: process.env.HIVE_CLIENT_SECRET,

    // The profile callback receives the decoded OIDC JWT payload from Hive
    profile(profile)
    {
        console.log('profile', profile);
        return {
            id: profile.sub.toString(),
            name: `${profile.given_name} ${profile.family_name}`,
            email: profile.email || null,
            username: profile.username,
            clearance: profile.clearance,
            program: profile.program,
            gender: profile.gender,
            display_name: profile.display_name,
            is_teacher: profile.is_teacher,
            accessToken: profile.api_token,
        };
    },
};

type JwtCallback = CallbacksOptions<HiveSsoProfile, HiveAccount>[ 'jwt' ];
type SessionCallback = CallbacksOptions<HiveSsoProfile, HiveAccount>[ 'session' ];

const jwtCallback: JwtCallback = async ({ token, account, user, trigger, profile }) =>
{
    if (trigger !== 'signIn' && trigger !== 'signUp') { return token; }

    if (user)
    {
        const hiveUser = user as HiveUser;
        const extraData: Partial<AuthSessionData> = {
            user: hiveUser,
            accessToken: hiveUser.accessToken,
        };
        token.data = extraData;
    }

    return token;
};

const sessionCallback: SessionCallback = async ({ session, token }) =>
{
    if (session.user && token && token.data)
    {
        const authSessionData: AuthSessionData = session as AuthSessionData;
        authSessionData.user = (token.data as AuthSessionData).user;
        authSessionData.accessToken = (token.data as AuthSessionData).accessToken;
        session = authSessionData;
    }
    return session;
};

export const authOptions: AuthOptions = {
    providers: [
        HIVE_PROVIDER
    ],
    pages: {
        signIn: '/login',
    },
    callbacks: {
        jwt: jwtCallback as CallbacksOptions[ 'jwt' ],
        session: sessionCallback,
    },
};

