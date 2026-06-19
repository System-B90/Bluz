import path from "path";

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    transpilePackages: [ "mui-color-input" ],
    serverExternalPackages: [ "pino", "pino-pretty" ],
    output: "standalone",
    allowedDevOrigins: [ "bluz.dev" ],
    outputFileTracingIncludes: {
        "/*": [ "./node_modules/drizzle-orm/**/*", "./node_modules/pg/**/*" ],
    },
    turbopack: {
        root: path.resolve(__dirname),
    },
    experimental: {
        optimizePackageImports: [ "@mui/x-date-pickers" ],
    },

};

export default nextConfig;
