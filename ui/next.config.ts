import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    /* config options here */
    transpilePackages: ["mui-color-input"],
    serverExternalPackages: ["pino", "pino-pretty"],
    output: "standalone",
    allowedDevOrigins: ["bluz.bis"],
    outputFileTracingIncludes: {
        "/*": ["./node_modules/drizzle-orm/**/*", "./node_modules/pg/**/*"],
    },
};

export default nextConfig;
