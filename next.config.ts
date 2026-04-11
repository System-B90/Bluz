import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: [ 'mui-color-input' ],
  serverExternalPackages: [ 'pino', 'pino-pretty' ],
  output: 'standalone'
};

export default nextConfig;
