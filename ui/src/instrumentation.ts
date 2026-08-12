import { registerOTel } from "@vercel/otel";

import { DbSettings } from "@/api-server/db-settings";
import { startLessonActivationLoop } from "@/api-server/hive/lesson-activation";

export function register() {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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
