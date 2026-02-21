import { registerOTel } from '@vercel/otel';
import sessionServer from '@/session-server/src/server';
import { DbSettings } from '@/api-server/db-settings';
export function register()
{
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    registerOTel('next-app');
    if (!sessionServer)
    {
        console.error('No session server object!');
    }

    DbSettings.init().then(() =>
    {
        console.log(`Successfully initialized Settings DB!`);
    }).catch((error) =>
    {
        console.error(`Failed to initialize Settings DB!`, error);
    });
}
