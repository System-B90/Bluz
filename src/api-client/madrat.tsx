import { safeApiFetcher } from "@/api-client/common";

export async function apiPostMadratMessage(messageText: string)
{
    await safeApiFetcher('/api/madrat', {
        method: 'POST',
        body: messageText,
    });
}

export async function apiGetMadratMessage(): Promise<string>
{
    return (await safeApiFetcher('/api/madrat')) as string;
}
