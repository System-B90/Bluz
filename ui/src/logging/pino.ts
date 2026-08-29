import { pino, type LoggerOptions, type Logger } from "pino";

// The pino-pretty transport is deliberately development-only. `transport`
// resolves its target at runtime, from a worker thread, by module resolution —
// which cannot work in the production image: drizzle-migrate.ts is esbuild
// *bundled* into /app/migrate.js (ui/Dockerfile), so pino-pretty is neither in
// the bundle nor resolvable from /app. Configuring it unconditionally made
// migrate.js throw "unable to determine transport target for pino-pretty" at
// module load, and docker-entrypoint.sh runs under `set -e`, so the container
// died before ever reaching the app.
//
// The Next server survived it only because next.config.ts lists pino and
// pino-pretty in serverExternalPackages, keeping them as real node_modules
// there. Production logs as JSON on stdout, which is what the log collectors
// want anyway.
const isDevelopment = process.env.NODE_ENV !== "production";

const options: LoggerOptions = {
    level: process.env.PINO_LOG_LEVEL || "info",

    redact: [], // prevent logging of sensitive data
};

if (isDevelopment) {
    options.transport = {
        target: "pino-pretty",
        options: {
            colorize: true,
        },
    };
}

export const logger: Logger = pino(options);
