import { describe, expect, it } from "vitest";

import {
    ClientApiError,
    constructErrorFromNetworkMessage,
} from "@/api-shared/errors";

describe("ClientApiError", () => {
    it("carries through structured fields beyond name/message/status", () => {
        // Shape of a coded error payload as it arrives over the wire (a plain
        // parsed-JSON object, not an actual ClientApiError instance).
        const wire = {
            name: "SomeCodedError",
            message: "bad",
            status: "400",
            code: "invalid-plan",
            count: 3,
        } as unknown as ClientApiError;

        const error = new ClientApiError(wire);
        expect(error.name).toBe("SomeCodedError");
        expect(error.message).toBe("bad");
        expect(error.status).toBe("400");
        expect((error as unknown as { code: string }).code).toBe("invalid-plan");
        expect((error as unknown as { count: number }).count).toBe(3);
    });

    it("defaults the name when the payload carries none", () => {
        const wire = { message: "bad" } as unknown as ClientApiError;
        const error = new ClientApiError(wire);
        expect(error.name).toBe("ClientApiError");
    });

    it("still builds a plain error from a string message", () => {
        const error = new ClientApiError("plain message");
        expect(error.name).toBe("ClientApiError");
        expect(error.message).toBe("plain message");
    });
});

describe("constructErrorFromNetworkMessage", () => {
    it("round-trips a coded server error payload into a ClientApiError", () => {
        const error = constructErrorFromNetworkMessage({
            code: "already-cut",
            count: 5,
            message: "already cut",
        } as unknown as ClientApiError);

        expect(error).toBeInstanceOf(ClientApiError);
        expect(error.message).toBe("already cut");
        expect((error as unknown as { code: string }).code).toBe("already-cut");
        expect((error as unknown as { count: number }).count).toBe(5);
    });
});
