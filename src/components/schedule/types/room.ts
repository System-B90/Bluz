import { Class, ClassTypeEnum } from "@/api-server/hive/types";

export interface Room extends Class
{
    /** @maxLength 100 */
    name: string;
    readonly display_name: string;
    /**
     * @maxLength 100
     * @nullable
     */
    description?: string | null;
    /** @maxLength 254 */
    email?: string;
    readonly id: number;
    program: number;
    readonly program__name: string;
    type: ClassTypeEnum.Room;
    users: Array<number>;
}

export type RoomLike = Room | string | number;
