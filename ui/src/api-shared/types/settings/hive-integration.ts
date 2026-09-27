export const HIVE_INTEGRATION_SETTING_KEY = "hiveIntegration";

/**
 * Who opens Hive lessons when a Bluz event goes live. One value, so the two
 * paths can never run together and double-assign a class.
 */
export enum HiveLessonDriver {
    /** Bluz's own 30s activator calls `classes/{id}/lesson/` (the default). */
    ACTIVATOR = "activator",
    /**
     * Bluz publishes its schedule as ICS for Hive's external schedule mode
     * and Hive's `update_schedule` task assigns the lessons itself.
     */
    ICS_FEED = "icsFeed",
}

export type HiveIntegrationSettings = {
    lessonDriver: HiveLessonDriver;
};

export const DEFAULT_HIVE_LESSON_DRIVER = HiveLessonDriver.ACTIVATOR;

export function isHiveLessonDriver(value: unknown): value is HiveLessonDriver {
    return Object.values(HiveLessonDriver).includes(value as HiveLessonDriver);
}
