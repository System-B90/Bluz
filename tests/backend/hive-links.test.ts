import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
    hiveClassUrl,
    hiveModuleUrl,
    hiveSubjectUrl,
} from "@/api-shared/hive-links";

describe("hive-links", () => {
    const original = process.env.NEXT_PUBLIC_HIVE_URL;
    beforeEach(() => {
        process.env.NEXT_PUBLIC_HIVE_URL = "https://hive.example";
    });
    afterEach(() => {
        process.env.NEXT_PUBLIC_HIVE_URL = original;
    });

    it("builds a module URL from the env base", () => {
        expect(hiveModuleUrl(4, 17)).toBe("https://hive.example/course/4/17");
    });

    it("prefers an explicit base over the env one, and strips its trailing slash", () => {
        expect(hiveModuleUrl(4, 17, "https://other.example/")).toBe(
            "https://other.example/course/4/17",
        );
    });

    it("returns null when either id is missing or zero", () => {
        expect(hiveModuleUrl(null, 17)).toBeNull();
        expect(hiveModuleUrl(4, undefined)).toBeNull();
        expect(hiveModuleUrl(0, 17)).toBeNull();
    });

    it("returns null when no Hive URL is configured", () => {
        delete process.env.NEXT_PUBLIC_HIVE_URL;

        expect(hiveModuleUrl(4, 17)).toBeNull();
        expect(hiveSubjectUrl(4)).toBeNull();
        expect(hiveClassUrl(9)).toBeNull();
    });

    it("builds subject and mentor-class URLs", () => {
        expect(hiveSubjectUrl(4)).toBe("https://hive.example/course/4");
        expect(hiveClassUrl(9)).toBe(
            "https://hive.example/mentor/classes?id=9",
        );
    });

    it("returns null for a missing class id", () => {
        expect(hiveClassUrl(undefined)).toBeNull();
        expect(hiveSubjectUrl(null)).toBeNull();
    });
});
