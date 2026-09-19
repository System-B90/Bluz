/*
 * Bundle entry for the vendored ExcelJS unit (#690).
 *
 * Only `Workbook` is re-exported: it is the single runtime value the Excel
 * export uses. Everything else workbook.ts touches -- Cell, Row, Worksheet,
 * Border, Borders, CellValue -- is a type, erased before this file matters.
 * Narrowing the entry this way is what lets esbuild drop most of the library.
 */
export { Workbook } from "exceljs";
