import { describe, expect, it } from "vitest";

import {
    relatedCourses,
    relatedCoursesResolver,
} from "@/api-shared/course-tree";

/*
 *          root
 *        /      \
 *      mid      sibling
 *     /   \
 *   leaf  leaf2
 *    |
 *   deep
 */
const TREE = [
    { id: "root", parentId: null },
    { id: "mid", parentId: "root" },
    { id: "sibling", parentId: "root" },
    { id: "leaf", parentId: "mid" },
    { id: "leaf2", parentId: "mid" },
    { id: "deep", parentId: "leaf" },
];

const sorted = (set: Set<string>) => [...set].sort();

/** Reference: walk the tree naively, no indexing, no caching. */
function naive(
    ids: Array<string>,
    courses: Array<{ id: string; parentId: null | string }>,
): Array<string> {
    const known = new Set(courses.map((c) => c.id));
    const out = new Set<string>();
    for (const id of ids) {
        if (!known.has(id)) continue;
        const up = new Set<string>();
        for (
            let cur: null | string | undefined = id;
            cur && known.has(cur) && !up.has(cur);
            cur = courses.find((c) => c.id === cur)?.parentId
        ) {
            up.add(cur);
        }
        const down = [id];
        const seenDown = new Set<string>();
        while (down.length) {
            const cur = down.pop()!;
            if (seenDown.has(cur)) continue;
            seenDown.add(cur);
            down.push(...courses.filter((c) => c.parentId === cur).map((c) => c.id));
        }
        for (const x of [...up, ...seenDown]) out.add(x);
    }
    return [...out].sort();
}

describe("relatedCoursesResolver", () => {
    const resolve = relatedCoursesResolver(TREE);

    it("returns a course's ancestors and descendants, never siblings", () => {
        expect(sorted(resolve(["mid"]))).toEqual(
            ["deep", "leaf", "leaf2", "mid", "root"].sort(),
        );
    });

    it("returns the whole tree for the root", () => {
        expect(sorted(resolve(["root"]))).toEqual(TREE.map((c) => c.id).sort());
    });

    it("returns just the ancestor chain for a leaf", () => {
        expect(sorted(resolve(["deep"]))).toEqual(
            ["deep", "leaf", "mid", "root"].sort(),
        );
    });

    it("unions several courses", () => {
        expect(sorted(resolve(["deep", "sibling"]))).toEqual(
            ["deep", "leaf", "mid", "root", "sibling"].sort(),
        );
    });

    it("ignores unknown ids", () => {
        expect(sorted(resolve(["ghost", "sibling"]))).toEqual(
            ["root", "sibling"].sort(),
        );
        expect(resolve(["ghost"]).size).toBe(0);
    });

    it("returns an empty set for no courses", () => {
        expect(resolve([]).size).toBe(0);
    });

    it("tolerates duplicates in the input", () => {
        expect(sorted(resolve(["leaf", "leaf", "leaf"]))).toEqual(
            sorted(resolve(["leaf"])),
        );
    });

    it("accepts any iterable, including a Set", () => {
        expect(sorted(resolve(new Set(["leaf2"])))).toEqual(
            ["leaf2", "mid", "root"].sort(),
        );
    });

    it("stops at a parent that is not in the list", () => {
        const orphan = relatedCoursesResolver([
            { id: "a", parentId: "missing" },
            { id: "b", parentId: "a" },
        ]);

        expect(sorted(orphan(["b"]))).toEqual(["a", "b"]);
    });

    it("terminates on a cycle", () => {
        const cyclic = relatedCoursesResolver([
            { id: "a", parentId: "c" },
            { id: "b", parentId: "a" },
            { id: "c", parentId: "b" },
        ]);

        expect(sorted(cyclic(["a"]))).toEqual(["a", "b", "c"]);
    });

    it("terminates on a self-parent", () => {
        const self = relatedCoursesResolver([{ id: "a", parentId: "a" }]);

        expect(sorted(self(["a"]))).toEqual(["a"]);
    });

    it("returns a fresh set each call, so callers cannot poison the cache", () => {
        const first = resolve(["leaf"]);
        first.add("poison");
        first.delete("root");

        expect(sorted(resolve(["leaf"]))).toEqual(
            ["deep", "leaf", "mid", "root"].sort(),
        );
    });

    it("gives the same answer repeatedly (cached)", () => {
        const a = sorted(resolve(["mid", "sibling"]));
        const b = sorted(resolve(["mid", "sibling"]));

        expect(b).toEqual(a);
    });

    it("does not mutate the course list", () => {
        const courses = TREE.map((c) => ({ ...c }));
        const snapshot = JSON.stringify(courses);

        relatedCoursesResolver(courses)(["root"]);

        expect(JSON.stringify(courses)).toBe(snapshot);
    });

    it("matches relatedCourses for every subset of the tree", () => {
        const ids = [...TREE.map((c) => c.id), "ghost"];
        for (let mask = 0; mask < 1 << ids.length; mask++) {
            const subset = ids.filter((_, i) => mask & (1 << i));

            expect(sorted(resolve(subset))).toEqual(
                sorted(relatedCourses(subset, TREE)),
            );
        }
    });

    it("matches a naive walk on random forests", () => {
        let state = 7;
        const random = () => {
            state = (state * 1_103_515_245 + 12_345) % 2 ** 31;
            return state / 2 ** 31;
        };
        for (let round = 0; round < 100; round++) {
            const size = 1 + Math.floor(random() * 40);
            const courses = Array.from({ length: size }, (_, i) => ({
                id: `c${i}`,
                // Mostly a forest, sometimes a dangling or cyclic parent.
                parentId:
                    random() < 0.2
                        ? null
                        : `c${Math.floor(random() * (random() < 0.9 ? i : size + 2))}`,
            }));
            const resolver = relatedCoursesResolver(courses);
            for (let q = 0; q < 10; q++) {
                const pick = Array.from(
                    { length: Math.floor(random() * 4) },
                    () => `c${Math.floor(random() * (size + 2))}`,
                );

                expect(sorted(resolver(pick))).toEqual(naive(pick, courses));
            }
        }
    });

    it("stays fast on a large tree queried many times", () => {
        const courses = Array.from({ length: 2000 }, (_, i) => ({
            id: `c${i}`,
            parentId: i === 0 ? null : `c${Math.floor((i - 1) / 3)}`,
        }));
        const resolver = relatedCoursesResolver(courses);

        const started = performance.now();
        for (let i = 0; i < 2000; i++) resolver([`c${i}`]);

        expect(performance.now() - started).toBeLessThan(2000);
    });
});
