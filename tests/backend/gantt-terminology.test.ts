import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

import { GANTT_GLOSSARY, GANTT_TERMS } from "@/components/gantt/glossary";

/**
 * One name per concept in the gantt UI (#832): סילבוס (not מקצוע), מערך (not
 * מודול), מסלול (not קורס, for the course tree). A source scan keeps synonyms
 * from creeping back into user-facing strings.
 */

const UI = path.resolve(import.meta.dirname, "../../ui/src");

function sourceFiles(dir: string): Array<string> {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return sourceFiles(full);
        return /\.tsx?$/.test(name) ? [ full ] : [];
    });
}

/** Non-comment lines, so notes explaining the old words don't trip the scan. */
function codeLines(file: string): Array<{ line: string; where: string }> {
    return readFileSync(file, "utf8")
        .split("\n")
        .map((line, i) => ({ line, where: `${path.relative(UI, file)}:${i + 1}` }))
        .filter(({ line }) => !/^\s*(\/\/|\*|\/\*)/.test(line));
}

const GANTT_UI = [
    ...sourceFiles(path.join(UI, "components/gantt")),
    ...sourceFiles(path.join(UI, "components/app-onboarding/gantt")),
];

describe("gantt terminology (#832)", () => {
    it("calls a syllabus סילבוס, never מקצוע (מקצוע stays for Hive subjects and the אחראי מקצוע role)", () => {
        const offenders = GANTT_UI.flatMap(codeLines)
            .filter(({ line }) => /מקצוע/.test(line.replaceAll("אחראי מקצוע", "")))
            .map(({ where }) => where);
        expect(offenders).toEqual([]);
    });

    it("calls a module מערך, never מודול (מודול stays for Hive modules)", () => {
        const offenders = GANTT_UI.flatMap(codeLines)
            .filter(({ line }) => /מודול/.test(line) && !/הייב|hive/i.test(line))
            .map(({ where }) => where);
        expect(offenders.filter((where) => !where.includes("EventHiveLinkageFields"))).toEqual([]);
    });

    it("calls an event מופע, never מפגש", () => {
        const offenders = GANTT_UI.flatMap(codeLines)
            .filter(({ line }) => /מפגש/.test(line))
            .map(({ where }) => where);
        expect(offenders).toEqual([]);
    });

    it("names the course-tree settings tab with מסלולים", () => {
        const dialog = readFileSync(path.join(UI, "components/settings-dialog/SettingsDialog.tsx"), "utf8");
        expect(dialog).toContain("בניית מסלולים");
        expect(dialog).not.toContain("בניית קורסים");
    });

    it("documents every core term in the glossary", () => {
        const terms = GANTT_GLOSSARY.map((entry) => entry.term);
        for (const term of [ GANTT_TERMS.syllabus, GANTT_TERMS.module, GANTT_TERMS.event, GANTT_TERMS.course, GANTT_TERMS.shuffle ]) {
            expect(terms).toContain(term);
        }
    });
});
