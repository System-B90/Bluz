import { describe, expect, it } from "vitest";

import {
    resourceKeyToResolvable,
    roomLikeToResourceKey,
    RoomSource,
} from "@/api-shared/types/room";
import type { ResolvableRoom } from "@/api-shared/types/room";

describe("room resource key (#170)", () => {
    it("round-trips a Hive room, preserving numeric id", () => {
        const room: ResolvableRoom = { id: 42, source: RoomSource.Hive };
        const key = roomLikeToResourceKey(room);
        expect(resourceKeyToResolvable(key)).toEqual(room);
    });

    it("round-trips a custom room whose id contains hyphens", () => {
        const room: ResolvableRoom = {
            id: "no-room-unassigned",
            source: RoomSource.Custom,
        };
        const key = roomLikeToResourceKey(room);
        // The old JSON.stringify / hyphen-split approaches would mis-parse this.
        expect(resourceKeyToResolvable(key)).toEqual(room);
    });

    it("produces matching keys for logically-equal rooms with different shapes", () => {
        // Full room object (extra fields) vs the resolvable projection.
        const full = {
            id: 7,
            name: "Room 7",
            source: RoomSource.Hive,
            description: "extra",
        } as unknown as Parameters<typeof roomLikeToResourceKey>[0];
        const resolvable: ResolvableRoom = { id: 7, source: RoomSource.Hive };
        expect(roomLikeToResourceKey(full)).toBe(
            roomLikeToResourceKey(resolvable),
        );
    });
});
