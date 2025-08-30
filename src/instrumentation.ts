import { registerOTel } from '@vercel/otel';
import sessionServer from '@/session-server/src/server';
export function register()
{
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    registerOTel('next-app');
    if (!sessionServer)
    {
        console.error('No session server object!');
    }
}
