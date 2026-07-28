import { beforeAll, describe, expect, it } from "vitest";

import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";

describe("dayjs timezone setup (#168)", () => {
    // The first .tz() call in a process builds Node's Intl timezone database;
    // every later call is ~1ms. Without this warm-up that one-time cost lands
    // on whichever test happens to run first, which timed out at 5s on the
    // self-hosted runner while the next identical assertion took 1ms. Paying
    // it in a hook keeps each test's budget measuring the assertion.
    beforeAll(() => {
        dayjs.utc("2026-01-15T08:00:00Z").tz(APP_TIMEZONE).format("HH:mm");
    }, 60_000);

    it("loads the utc and timezone plugins", () => {
        expect(typeof dayjs.utc).toBe("function");
        expect(typeof dayjs.tz).toBe("function");
    });

    it("renders Israel wall-clock correctly in winter (UTC+2)", () => {
        // 2026-01-15 08:00 UTC -> 10:00 Israel Standard Time.
        const t = dayjs.utc("2026-01-15T08:00:00Z").tz(APP_TIMEZONE);
        expect(t.format("HH:mm")).toBe("10:00");
        expect(t.utcOffset()).toBe(120);
    });

    it("renders Israel wall-clock correctly in summer DST (UTC+3)", () => {
        // 2026-07-15 08:00 UTC -> 11:00 Israel Daylight Time.
        const t = dayjs.utc("2026-07-15T08:00:00Z").tz(APP_TIMEZONE);
        expect(t.format("HH:mm")).toBe("11:00");
        expect(t.utcOffset()).toBe(180);
    });

    it("keeps the same instant across the DST boundary (no hour drift)", () => {
        const winter = dayjs.utc("2026-01-15T08:00:00Z");
        const summer = dayjs.utc("2026-07-15T08:00:00Z");
        // Anchoring to the app timezone must not change the underlying instant.
        expect(winter.tz(APP_TIMEZONE).valueOf()).toBe(winter.valueOf());
        expect(summer.tz(APP_TIMEZONE).valueOf()).toBe(summer.valueOf());
    });
});
