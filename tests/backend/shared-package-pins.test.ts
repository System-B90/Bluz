import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

/*
 * `@system-b90/*` packages are installed twice — once at the repo root for the
 * Next app, once under `session-server/` for the WS server — and `settings.tsx`
 * re-exports `session-server/session-common.ts`, which resolves the *nested*
 * copy. So a bump applied to only one manifest type-checks against one version
 * and runs against the other.
 *
 * That is exactly what happened bumping session-ws to 0.5.0 (#656): the root
 * went to 0.5.0 while `session-server/` sat on 0.3.0, and `tsc` reported the
 * new exports as missing from a package that plainly had them. The failure
 * names the symbol, never the duplicate install, so it costs real time.
 */

const ROOT = join(__dirname, "..", "..");
const SESSION_SERVER = join(ROOT, "session-server");

type Manifest = {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
};

function manifest(dir: string): Manifest {
    return JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
}

/** Declared `@system-b90/*` pins in a manifest. */
function sharedPins(dir: string): Record<string, string> {
    const { dependencies = {}, devDependencies = {} } = manifest(dir);
    return Object.fromEntries(
        Object.entries({ ...dependencies, ...devDependencies }).filter(([name]) =>
            name.startsWith("@system-b90/"),
        ),
    );
}

/** The version actually installed under `dir`, or null when absent. */
function installedVersion(dir: string, pkg: string): null | string {
    try {
        const require = createRequire(join(dir, "package.json"));
        return require(`${pkg}/package.json`).version as string;
    } catch {
        return null;
    }
}

const rootPins = sharedPins(ROOT);
const serverPins = sharedPins(SESSION_SERVER);
const sharedNames = Object.keys(rootPins).filter((name) => name in serverPins);

describe("@system-b90 packages installed in both trees", () => {
    it("has at least one such package, or this guard is silently vacuous", () => {
        expect(sharedNames.length).toBeGreaterThan(0);
    });

    it.each(sharedNames)("%s is pinned identically in both manifests", (name) => {
        expect(serverPins[name]).toBe(rootPins[name]);
    });

    it.each(sharedNames)(
        "%s resolves to the same installed version in both trees",
        (name) => {
            const root = installedVersion(ROOT, name);
            const server = installedVersion(SESSION_SERVER, name);

            // A missing install is a different problem (no `npm install` yet);
            // this guard is about the two trees disagreeing.
            if (root === null || server === null) return;

            expect(
                server,
                `${name}: root has ${root}, session-server has ${server} — run npm install in both`,
            ).toBe(root);
        },
    );
});
