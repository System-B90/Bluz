// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import { readJsonFile } from "@/components/base/read-json-file";

const file = (text: string) => new File([text], "x.json", { type: "application/json" });

describe("readJsonFile", () => {
    it("parses an object", async () => {
        await expect(readJsonFile(file('{"a":1}'))).resolves.toEqual({ a: 1 });
    });

    it("parses an array", async () => {
        await expect(readJsonFile(file("[1,2]"))).resolves.toEqual([1, 2]);
    });

    it("keeps Hebrew text intact", async () => {
        await expect(readJsonFile(file('{"title":"סילבוס"}'))).resolves.toEqual({ title: "סילבוס" });
    });

    it("rejects invalid JSON", async () => {
        await expect(readJsonFile(file("nope"))).rejects.toThrow(SyntaxError);
    });

    it("rejects an empty file", async () => {
        await expect(readJsonFile(file(""))).rejects.toThrow();
    });
});
