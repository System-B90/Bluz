import { describe, expect, it } from "vitest";

import * as bundleExports from "@vendor/exceljs";
import { Workbook } from "@vendor/exceljs";

/**
 * Pins the ExcelJS surface the Excel export actually uses, against the
 * *vendored bundle* rather than the npm package (#690).
 *
 * This is the safety net for regenerating `dist/`: the bundle is minified and
 * unreviewable by eye, so the only meaningful check that an upgrade did not
 * break the export is exercising every feature `workbook.ts` relies on and
 * confirming a real .xlsx comes out.
 */

/** Builds a workbook using every surface from the vendor README's table. */
async function buildProbeWorkbook() {
    const workbook = new Workbook();
    const sheet = workbook.addWorksheet("גיליון");

    sheet.columns = [
        { header: "נושא", key: "topic", width: 32 },
        { header: "שעות", key: "hours", width: 10 },
    ];

    const row = sheet.addRow({ topic: "מבוא", hours: 2.75 });

    const cell = row.getCell(1);
    cell.font = { bold: true, size: 12, color: { argb: "FF0D2336" } };
    cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFCDEAF0" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
        top: { style: "thin", color: { argb: "FFD9D9D9" } },
        bottom: { style: "thin", color: { argb: "FFD9D9D9" } },
    };
    row.getCell(2).numFmt = "0.00";

    sheet.mergeCells("A3:B3");
    sheet.getCell("A3").value = "כותרת מאוחדת";
    sheet.getRow(1).height = 22;

    return { workbook, sheet };
}

describe("vendored ExcelJS bundle", () => {
    it("exposes Workbook as a constructible runtime value", () => {
        expect(typeof Workbook).toBe("function");
        expect(new Workbook()).toBeInstanceOf(Workbook);
    });

    it("is the only runtime export, by design", () => {
        // Everything else workbook.ts uses is a type. Keeping the runtime
        // surface to one value is what lets esbuild drop most of the library,
        // so a new runtime export here should be a deliberate decision.
        expect(Object.keys(bundleExports).sort()).toEqual([ "Workbook" ]);
    });

    it("creates worksheets and sets column widths", async () => {
        const { workbook, sheet } = await buildProbeWorkbook();

        expect(workbook.worksheets).toHaveLength(1);
        expect(sheet.name).toBe("גיליון");
        expect(sheet.getColumn(1).width).toBe(32);
    });

    it("writes row values addressable by key and by index", async () => {
        const { sheet } = await buildProbeWorkbook();

        expect(sheet.getRow(2).getCell(1).value).toBe("מבוא");
        expect(sheet.getRow(2).getCell("hours").value).toBe(2.75);
    });

    it("retains every style property the export sets", async () => {
        const { sheet } = await buildProbeWorkbook();
        const cell = sheet.getRow(2).getCell(1);

        expect(cell.font?.bold).toBe(true);
        expect(cell.font?.color?.argb).toBe("FF0D2336");
        expect(cell.fill).toMatchObject({ type: "pattern", pattern: "solid" });
        expect(cell.alignment?.horizontal).toBe("center");
        expect(cell.alignment?.wrapText).toBe(true);
        expect(cell.border?.top?.style).toBe("thin");
        expect(sheet.getRow(2).getCell(2).numFmt).toBe("0.00");
    });

    it("merges cells across a range", async () => {
        const { sheet } = await buildProbeWorkbook();

        expect(sheet.getCell("A3").value).toBe("כותרת מאוחדת");
        // The merged partner reads through to the master cell.
        expect(sheet.getCell("B3").value).toBe("כותרת מאוחדת");
    });

    it("sets row height", async () => {
        const { sheet } = await buildProbeWorkbook();

        expect(sheet.getRow(1).height).toBe(22);
    });

    it("writes a real xlsx buffer", async () => {
        const { workbook } = await buildProbeWorkbook();

        const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

        // xlsx is a zip: "PK" magic. A truncated or HTML error payload fails
        // here rather than in the user's Excel.
        expect(buffer.subarray(0, 2).toString("latin1")).toBe("PK");
        expect(buffer.length).toBeGreaterThan(1000);
    });

    it("round-trips Hebrew text through the written file", async () => {
        // RTL content is the whole reason the alternatives in #690 were
        // rejected, so it gets its own assertion.
        const { workbook } = await buildProbeWorkbook();
        const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

        const reread = new Workbook();
        await reread.xlsx.load(buffer);
        const sheet = reread.getWorksheet("גיליון");

        expect(sheet?.getRow(2).getCell(1).value).toBe("מבוא");
        expect(sheet?.getCell("A3").value).toBe("כותרת מאוחדת");
    });

    it("preserves styling through a write/read round trip", async () => {
        const { workbook } = await buildProbeWorkbook();
        const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

        const reread = new Workbook();
        await reread.xlsx.load(buffer);
        const cell = reread.getWorksheet("גיליון")?.getRow(2).getCell(1);

        expect(cell?.font?.bold).toBe(true);
        expect(cell?.alignment?.horizontal).toBe("center");
    });
});
