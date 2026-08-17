
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

import type { NextConfig } from "next";

// Resolved relative to this file's own location (not process.cwd(), which
// varies depending on whether Next is invoked from the repo root or ui/).
const packageJson = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "package.json"), "utf-8"),
);

const nextConfig: NextConfig = {
    env: {
        // Faded version label in the settings dialog (#455). Read at build
        // time from the root package.json, the single source of truth for
        // BLUZ_VERSION too (see scripts/install.sh).
        NEXT_PUBLIC_APP_VERSION: packageJson.version,
    },
    transpilePackages: [ "mui-color-input" ],
    serverExternalPackages: [ "pino", "pino-pretty" ],
    output: "standalone",
    allowedDevOrigins: [ "bluz.dev" ],
    outputFileTracingIncludes: {
        "/*": [ "./node_modules/drizzle-orm/**/*", "./node_modules/pg/**/*" ],
    },
    experimental: {
        optimizePackageImports: [ "@mui/x-date-pickers" ],
    },
    turbopack: {
        root: process.cwd(),
    },
};

export default nextConfig;
