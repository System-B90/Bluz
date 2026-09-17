import { registerOTel } from "@vercel/otel";

import { DbSettings } from "@/api-server/db-settings";
import { startLessonActivationLoop } from "@/api-server/hive/lesson-activation";

export function register() {
    // Self-signed Hive/dev proxies need this off, and `.env` (setup.py) owns
    // that knob. Hardcoding "0" here overrode the operator's choice and left
    // production accepting any certificate on every outbound TLS call
    // (Hive SSO token exchange, Google Calendar).
    if (
        process.env.NODE_ENV !== "production" &&
        process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined
    ) {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
    }

    if (process.env.NODE_ENV === "production") {
        registerOTel("next-app");
    }

    DbSettings.init()
        .then(() => {
            console.log(`Successfully initialized Settings DB!`);
        })
        .catch((error) => {
            console.error(`Failed to initialize Settings DB!`, error);
        });

    // Opens the Hive queue of an event the minute it starts. Self-disabling
    // when no service account is configured.
    startLessonActivationLoop();
}
