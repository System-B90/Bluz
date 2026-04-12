import { safeApiFetcher } from "@/api-client/common";
import { Room } from "@/components/schedule/types/room";

export async function apiGetRooms()
{
    return ((await safeApiFetcher('/api/rooms')) as Array<Room>);
}
