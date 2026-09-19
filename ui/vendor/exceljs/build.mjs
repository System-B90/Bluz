/*
 * Name: build.mjs
 * Purpose: Regenerates the vendored, self-contained ExcelJS bundle (#690).
 * Created: 2026-09-19
 * Author: Michael K. Steinberg
 *
 * Usage: npm i --no-save exceljs@4.4.0 && node ui/vendor/exceljs/build.mjs
 *
 * `exceljs` is deliberately NOT a dependency of this repo -- vendoring the
 * bundle is the whole point. Install it ad-hoc to regenerate, then drop it.
 */

import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "esbuild";

const HERE = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/** The version the committed bundle was produced from. */
const PINNED_VERSION = "4.4.0";

const pkg = require("exceljs/package.json");
if (pkg.version !== PINNED_VERSION) {
    throw new Error(
        `Refusing to build: exceljs ${pkg.version} is installed but the bundle ` +
            `is pinned to ${PINNED_VERSION}. Bump PINNED_VERSION here and in ` +
            `README.md deliberately, then rebuild.`,
    );
}

await build({
    entryPoints: [join(HERE, "entry.mjs")],
    bundle: true,
    format: "esm",
    platform: "node",
    // Node 20 is what the Dockerfile runs; nothing older has to parse this.
    target: "node20",
    minify: true,
    legalComments: "none",
    outfile: join(HERE, "dist", "exceljs.bundle.mjs"),
});

// Vendor ExcelJS's own declarations rather than hand-writing a subset: they
// are a single self-contained file with no imports, so copying them keeps the
// types exact and free of drift.
const types = require.resolve("exceljs/index.d.ts");
copyFileSync(types, join(HERE, "dist", "exceljs.bundle.d.ts"));

const bundle = readFileSync(join(HERE, "dist", "exceljs.bundle.mjs"));
writeFileSync(
    join(HERE, "dist", "PROVENANCE.txt"),
    [
        `exceljs version : ${PINNED_VERSION}`,
        `bundle bytes    : ${bundle.length}`,
        `built by        : ui/vendor/exceljs/build.mjs`,
        "",
        "Regenerate with:",
        "  npm i --no-save exceljs@" + PINNED_VERSION,
        "  node ui/vendor/exceljs/build.mjs",
        "",
    ].join("\n"),
);

console.log(
    `Bundled exceljs ${PINNED_VERSION} -> ${(bundle.length / 1024).toFixed(0)}KB`,
);
