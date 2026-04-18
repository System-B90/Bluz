import { registerOTel } from "@vercel/otel";

import { DbSettings } from "@/api-server/db-settings";

export function register()
{
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    registerOTel("next-app");

    DbSettings.init()
        .then(() =>
        {
            console.log(`Successfully initialized Settings DB!`);
        })
        .catch((error) =>
        {
            console.error(`Failed to initialize Settings DB!`, error);
        });
}
