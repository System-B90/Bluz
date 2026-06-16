import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    transpilePackages: ["mui-color-input"],
    serverExternalPackages: ["pino", "pino-pretty"],
    output: "standalone",
    allowedDevOrigins: ["bluz.dev"],
    outputFileTracingIncludes: {
        "/*": ["./node_modules/drizzle-orm/**/*", "./node_modules/pg/**/*"],
    },
    experimental: {
        optimizePackageImports: ["@mui/x-date-pickers"],
    },
};

export default nextConfig;
