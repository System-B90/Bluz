import { describe, expect, it } from "vitest";

import { EventLockMessage } from "@/api-shared/types";
import {
    lockedEditMessage,
    lockHoldersOf,
} from "@/components/schedule/calendar/calendar-provider/locked-edit";

const lock = (lockedByName: string) => ({ lockedById: lockedByName, lockedByName }) as EventLockMessage;

describe("locked quick-edit guard (#775)", () => {
    it("finds no holders when nothing is locked", () => {
        expect(lockHoldersOf([ "a", "b" ], {})).toEqual([]);
    });

    it("lists each holder once, in order", () => {
        const locks = { a: lock("דנה"), b: lock("יוסי"), c: lock("דנה") };
        expect(lockHoldersOf([ "c", "x", "b", "a" ], locks)).toEqual([ "דנה", "יוסי" ]);
    });

    it("falls back to a generic name when the lock has none", () => {
        expect(lockHoldersOf([ "a" ], { a: lock("") })).toEqual([ "משתמש אחר" ]);
    });

    it("names the holder and warns about their save", () => {
        const message = lockedEditMessage([ "דנה" ], 1);
        expect(message).toContain("המופע נערך כרגע על ידי דנה");
        expect(message).toContain("כשדנה ישמור");
    });

    it("phrases a multi-event, multi-holder edit in the plural", () => {
        const message = lockedEditMessage([ "דנה", "יוסי" ], 3);
        expect(message).toContain("חלק מהמופעים שנבחרו נערכים");
        expect(message).toContain("כשהם ישמרו");
    });
});
