import Box from "@mui/material/Box";
import { cookies } from "next/headers";
import { Suspense } from "react";

import { DbCliHandoff } from "@/api-server/db-cli-handoff";
import { getStaffSession } from "@/api-server/session-user";
import { CliAuthWidget } from "@/app/(themed)/(post-auth)/cli-auth/cli-auth-widget";

type PageProps = {
    searchParams: Promise<{ [key: string]: Array<string> | string | undefined }>;
};

// Loopback callback port: 1-5 digits, matching the CLI's ephemeral/well-known
// port range. A typeof-string check alone (the prior behaviour) let anything
// through the port searchParam into the callback URL the widget navigates or
// fetches -- validating the shape here closes that off (#520).
const PORT_PATTERN = /^\d{1,5}$/;

export default async function CliAuthPage({ searchParams }: PageProps) {
    const resolvedParams = await searchParams;
    const rawPort =
        typeof resolvedParams.port === "string" ? resolvedParams.port : "";
    const port = PORT_PATTERN.test(rawPort) ? rawPort : "";
    const code = typeof resolvedParams.code === "string" ? resolvedParams.code : "";
    const cookieStore = await cookies();
    const token =
        cookieStore.get("__Secure-next-auth.session-token")?.value ||
        cookieStore.get("next-auth.session-token")?.value ||
        "";

    // Mint a single-use handoff code server-side and hand *that* to the
    // client widget instead of the raw session token (#520). The token never
    // reaches the browser's DOM, a callback URL, or browser history -- the
    // CLI redeems the handoff code for the token itself over HTTPS
    // (POST /api/cli-auth/redeem), and the code is deleted on first use.
    // Staff-only, checked here as well as in the post-auth layout: a handoff
    // code is a session token in disguise, and the CLI it unlocks talks to
    // staff-gated endpoints (#656).
    const sessionUser = await getStaffSession();
    const handoffCode =
        token && sessionUser
            ? await DbCliHandoff.create(token, sessionUser.id)
            : "";

    return (
        <Box
            alignContent="flex-start"
            alignItems="flex-start"
            bgcolor="background.default"
            display="flex"
            height="100vh"
            justifyContent="center"
            justifyItems="flex-start"
            pt="20vh"
            width="100%"
        >
            <Suspense fallback={null}>
                <CliAuthWidget code={code} handoffCode={handoffCode} port={port} />
            </Suspense>
        </Box>
    );
}
