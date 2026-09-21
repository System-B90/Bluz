import {
    ClassTypeEnum,
    HiveClient as HiveClientBase,
} from "@system-b90/hive-core";

import { Class, Queue } from "@/api-shared/types/hive";
import { HiveRoom, RoomSource } from "@/api-shared/types/room";

export { isTimeoutError } from "@system-b90/hive-core";

/**
 * Bluz's Hive client: the request core (token refresh, 401 retry, 500
 * backoff, network-error classification, users/classes, lessons and lesson
 * rules, subjects, modules) lives in `@system-b90/hive-core`; this subclass
 * adds rooms and the student-group/module-queue shortcuts.
 */
export class HiveClient extends HiveClientBase {
    override async getClasses(): Promise<Array<Class>> {
        return await super.getClasses(ClassTypeEnum.Student_Group);
    }

    async getRooms(): Promise<Array<HiveRoom>> {
        return (
            await this._get<Array<HiveRoom>>(
                this.buildUrl("/api/core/management/classes/?type=Room"),
            )
        ).map((r) => ({ ...r, source: RoomSource.Hive }));
    }

    /**
     * The queues of one Hive module — the only queues a lesson rule may point
     * at (Hive rejects user queues on a rule).
     */
    async getModuleQueues(moduleId: number): Promise<Array<Queue>> {
        return await this.getQueues({ module: moduleId });
    }
}
