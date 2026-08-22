import Box from "@mui/material/Box";
import { cookies } from "next/headers";
import { Suspense } from "react";

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
                <CliAuthWidget code={code} port={port} token={token} />
            </Suspense>
        </Box>
    );
}
