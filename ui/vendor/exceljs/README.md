# Vendored ExcelJS

`dist/exceljs.bundle.mjs` is a precompiled, self-contained build of
[ExcelJS](https://github.com/exceljs/exceljs) **4.4.0**, committed on purpose.

## Why

The Excel export (`ui/src/app/api/gantt/curriculums/[id]/export/excel/`) is the
only thing in the app that needs ExcelJS, and it uses a small slice of it. The
package costs **nine direct dependencies and ~23MB of `node_modules`** — plus
their churn in every `npm ci`, every Docker layer and every audit — for one
route.

Bundling it costs **~1MB of committed JavaScript (~294KB gzipped)** and removes
the package from the dependency graph entirely. `exceljs` does not appear in
`package.json`; nothing installs it.

See System-B90/Bluz#690.

## What the app actually uses

Inventoried from `workbook.ts`, and pinned by
`tests/backend/excel-vendor-bundle.test.ts`:

| Surface | Used for |
| --- | --- |
| `new Workbook()` | the one runtime value |
| `addWorksheet`, `worksheet.columns` | sheet creation and column widths |
| `addRow`, `getRow`, `getCell` | writing cells |
| `mergeCells` | grouped header spans |
| `cell.font`, `.fill`, `.alignment`, `.border`, `.numFmt` | the themed styling |
| `workbook.xlsx.writeBuffer()` | producing the download |

Everything else `workbook.ts` references (`Cell`, `Row`, `Worksheet`, `Border`,
`Borders`, `CellValue`) is a **type**, erased at runtime — which is why
`entry.mjs` re-exports only `Workbook` and esbuild can drop the rest.

## Regenerating

`exceljs` is intentionally absent from `package.json`, so install it ad-hoc:

```bash
npm i --no-save exceljs@4.4.0
npm run build:vendor:exceljs
```

The build refuses to run against any version other than the pinned one. To
upgrade: bump `PINNED_VERSION` in `build.mjs` and the version in this file
together, rebuild, and **run the bundle test** — it exercises every surface in
the table above against the freshly built artifact.

`dist/PROVENANCE.txt` records the version and byte count the committed bundle
was produced from.

## Reviewing changes to dist/

The bundle is minified and will always show as one enormous diff. Do not read
it. What to check instead:

1. `PROVENANCE.txt` changed in the way the PR claims.
2. `build.mjs`'s `PINNED_VERSION` matches.
3. `tests/backend/excel-vendor-bundle.test.ts` passes.
4. The exports test (`tests/exports.spec.ts`) still passes end to end.
