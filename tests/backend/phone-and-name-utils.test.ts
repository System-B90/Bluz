import { describe, expect, it } from "vitest";

import { formatPhoneNumber } from "@/components/base/utils/phone-numbers";
import { shortenInstructorName } from "@/components/schedule/event-component/NameUtils";

describe("formatPhoneNumber", () => {
    it("formats a local mobile number", () => {
        expect(formatPhoneNumber("0501234567")).toBe("050-123-4567");
    });

    it("formats an already-punctuated local mobile number", () => {
        expect(formatPhoneNumber("050-123 4567")).toBe("050-123-4567");
    });

    it("formats an international mobile number", () => {
        expect(formatPhoneNumber("+972501234567")).toBe("+972-50-123-4567");
    });

    it("formats a local landline", () => {
        expect(formatPhoneNumber("031234567")).toBe("(03) 123-4567");
    });

    it("formats an international landline", () => {
        expect(formatPhoneNumber("+97231234567")).toBe("+972-3-123-4567");
    });

    it("returns anything it does not recognise unchanged", () => {
        expect(formatPhoneNumber("1-800-FLOWERS")).toBe("1-800-FLOWERS");
        expect(formatPhoneNumber("")).toBe("");
        expect(formatPhoneNumber("12345")).toBe("12345");
    });
});

describe("shortenInstructorName", () => {
    const names = [ "אבי כהן", "אבי כץ", "דנה לוי", "איש חוץ" ];

    it("keeps the placeholder outsider name whole", () => {
        expect(shortenInstructorName("איש חוץ", names)).toBe("איש חוץ");
    });

    it("uses just the first name when nothing collides", () => {
        expect(shortenInstructorName("דנה לוי", names)).toBe("דנה");
    });

    it("adds the minimum letters needed to break a collision", () => {
        expect(shortenInstructorName("אבי כהן", names)).toBe("אבי כה");
        expect(shortenInstructorName("אבי כץ", names)).toBe("אבי כץ");
    });

    it("falls back to the full name when no prefix disambiguates", () => {
        const twins = [ "אבי כהן", "אבי כהן דוד" ];

        expect(shortenInstructorName("אבי כהן", twins)).toBe("אבי כהן");
    });

    it("does not treat itself as a collision", () => {
        expect(shortenInstructorName("דנה לוי", [ "דנה לוי" ])).toBe("דנה");
    });

    it("does not collide on a first name that is only a prefix of another", () => {
        expect(shortenInstructorName("דן לוי", [ "דן לוי", "דנה כהן" ])).toBe(
            "דן",
        );
    });
});
