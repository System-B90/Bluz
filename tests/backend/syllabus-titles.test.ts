import { describe, expect, it } from "vitest";

import { disambiguatedSyllabusTitles } from "@/api-shared/gantt/syllabus-titles";
import { Course } from "@/api-shared/types/course";

/** Namesake syllabuses read as "דמות (אפולו)" / "דמות (מבצר)". */

const courses: Record<string, Course> = {
    c1: { id: "c1", name: "אפולו", color: null },
    c2: { id: "c2", name: "מבצר", color: null },
};
const getCourse = (id: string) => courses[id];

describe("disambiguatedSyllabusTitles", () => {
    it("brackets the course of each namesake", () => {
        const titles = disambiguatedSyllabusTitles(
            [
                { id: "s1", title: "דמות", courseIds: ["c1"] },
                { id: "s2", title: "דמות", courseIds: ["c2"] },
            ],
            getCourse,
        );
        expect(titles).toEqual({ s1: "דמות (אפולו)", s2: "דמות (מבצר)" });
    });

    it("keeps a unique title bare", () => {
        const titles = disambiguatedSyllabusTitles(
            [
                { id: "s1", title: "דמות", courseIds: ["c1"] },
                { id: "s2", title: "פיקוד", courseIds: ["c2"] },
            ],
            getCourse,
        );
        expect(titles).toEqual({ s1: "דמות", s2: "פיקוד" });
    });

    it("joins several courses", () => {
        const titles = disambiguatedSyllabusTitles(
            [
                { id: "s1", title: "דמות", courseIds: ["c1", "c2"] },
                { id: "s2", title: "דמות", courseIds: [] },
            ],
            getCourse,
        );
        expect(titles).toEqual({ s1: "דמות (אפולו, מבצר)", s2: "דמות" });
    });

    it("skips unknown courses", () => {
        const titles = disambiguatedSyllabusTitles(
            [
                { id: "s1", title: "דמות", courseIds: ["gone"] },
                { id: "s2", title: "דמות" },
            ],
            getCourse,
        );
        expect(titles).toEqual({ s1: "דמות", s2: "דמות" });
    });
});
