import { describe, expect, it } from "vitest";

/**
 * Option normalisation for `ask_user`.
 *
 * Whatever the model emits ends up as buttons in front of a person, so a
 * duplicate, a blank label or a list of twenty has to be cleaned up here
 * rather than rendered as a broken row.
 */

import { askUserTool, normalizeChoiceOptions } from "@/api-server/ai/tools/ask-user";
import { AiToolDanger, AiToolKind } from "@/api-shared/types/ai";

describe("normalizeChoiceOptions", () => {
    it("keeps well-formed options as they are", () => {
        expect(
            normalizeChoiceOptions([
                { value: "a", label: "יום שני", description: "9:00" },
                { value: "b", label: "יום רביעי" },
            ]),
        ).toEqual([
            { value: "a", label: "יום שני", description: "9:00" },
            { value: "b", label: "יום רביעי" },
        ]);
    });

    it("drops blanks and duplicates", () => {
        expect(
            normalizeChoiceOptions([
                { value: "a", label: "יום שני" },
                { value: "a", label: "יום שני שוב" },
                { value: "", label: "   " },
            ] as never),
        ).toEqual([{ value: "a", label: "יום שני" }]);
    });

    it("falls back to the label when the model omits a value", () => {
        expect(
            normalizeChoiceOptions([{ label: "כן" }] as never),
        ).toEqual([{ value: "כן", label: "כן" }]);
    });

    it("caps the list so a model cannot render twenty buttons", () => {
        const many = Array.from({ length: 20 }, (_, index) => ({
            value: `v${index}`,
            label: `אפשרות ${index}`,
        }));
        expect(normalizeChoiceOptions(many)).toHaveLength(6);
    });

    it("treats a missing list as no options", () => {
        expect(normalizeChoiceOptions(undefined)).toEqual([]);
    });
});

describe("askUserTool", () => {
    it("is a prompt tool, so it is never gated as a write", () => {
        expect(askUserTool.kind).toBe(AiToolKind.Prompt);
        expect(askUserTool.danger).toBe(AiToolDanger.Safe);
    });

    it("throws if it is ever executed", () => {
        // The agent loop intercepts it. If that interception is removed, this
        // must surface immediately rather than as the model quietly answering
        // its own question.
        expect(() => askUserTool.execute({} as never, {} as never)).toThrow();
    });
});
