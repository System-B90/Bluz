/*
 * Name: index.ts
 * Purpose: The app's only door to ExcelJS (#690).
 * Created: 2026-09-19
 * Author: Michael K. Steinberg
 *
 * `exceljs` pulls in nine direct dependencies and ~23MB of node_modules for
 * one export route, so it is not a dependency of this repo at all. The
 * precompiled bundle in ./dist is, and this module is what the app imports.
 *
 * Types come straight from ExcelJS's own declarations, copied verbatim at
 * build time, so they cannot drift from the bundle beside them.
 *
 * Regenerate both with `npm run build:vendor:exceljs` -- see ./README.md.
 */

import bundled from "@vendor/exceljs/dist/exceljs.bundle.cjs";
import type { Workbook as WorkbookInstance } from "@vendor/exceljs/dist/exceljs.bundle.js";

export type {
    Alignment,
    Border,
    Borders,
    Cell,
    CellValue,
    Column,
    Fill,
    Font,
    Row,
    Worksheet,
} from "@vendor/exceljs/dist/exceljs.bundle.js";

/**
 * The one runtime value the export route needs.
 *
 * Declared as a type and a value under the same name so `Workbook` reads as
 * both `new Workbook()` and `Promise<Workbook>`, the way the npm package's
 * class did.
 *
 * The cast is load-bearing: the bundle is plain JavaScript with no
 * declarations of its own, so without it the constructor infers as `any` and
 * every cell, row and sheet downstream silently loses its type.
 */
export type Workbook = WorkbookInstance;
export const Workbook = bundled.Workbook as new () => WorkbookInstance;
