import { registerOTel } from "@vercel/otel";

import { DbSettings } from "@/api-server/db-settings";
import { startLessonActivationLoop } from "@/api-server/hive/lesson-activation";

export function register() {
    // Bluz ships for airgapped networks by default (see SECURITY.md): Hive and
    // the reverse proxy in front of it are typically self-signed internally,
    // and the network boundary — not TLS — is what actually keeps the
    // deployment safe. `.env` (setup.py) sets this explicitly for every
    // generated deployment, including production; this is only a fallback
    // for a hand-rolled `.env` that omits it, and still respects an operator
    // who set it explicitly (e.g. a non-airgapped, internet-facing install).
    if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === undefined) {
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
