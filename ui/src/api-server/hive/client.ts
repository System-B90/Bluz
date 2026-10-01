import {
    ClassTypeEnum,
    HiveClient as HiveClientBase,
} from "@system-b90/hive-core";

import { Class, Queue } from "@/api-shared/types/hive";
import { HiveRoom, RoomSource } from "@/api-shared/types/room";

export { isTimeoutError } from "@system-b90/hive-core";

const CLASSES_TTL_MS = 3 * 60 * 1000;
/** Student groups per Hive base URL: shared data, not tied to one user's token. */
const classesCache = new Map<
    string,
    { at: number; classes: Promise<Array<Class>> }
>();

/**
 * Bluz's Hive client: the request core (token refresh, 401 retry, 500
 * backoff, network-error classification, users/classes, lessons and lesson
 * rules, subjects, modules) lives in `@system-b90/hive-core`; this subclass
 * adds rooms and the student-group/module-queue shortcuts.
 */
export class HiveClient extends HiveClientBase {
    /**
     * Student groups change rarely and Bluz never writes them, yet every cut,
     * lesson sync and feed fetches them: share one request per Hive instance
     * for `CLASSES_TTL_MS`. The promise is cached, so concurrent callers share
     * the in-flight request; a failure is dropped so the next call retries.
     */
    override async getClasses(): Promise<Array<Class>> {
        const key = this.hiveBaseUrl;
        const hit = classesCache.get(key);
        if (hit && Date.now() - hit.at < CLASSES_TTL_MS) {
            return [...(await hit.classes)];
        }
        const classes = super.getClasses(ClassTypeEnum.Student_Group);
        const entry = { at: Date.now(), classes };
        classesCache.set(key, entry);
        try {
            return [...(await classes)];
        } catch (error) {
            if (classesCache.get(key) === entry) classesCache.delete(key);
            throw error;
        }
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
