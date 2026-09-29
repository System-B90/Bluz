import { APIRequestContext } from "@playwright/test";

import { expect, test, waitForAppLoad } from "./fixtures";
import {
    apiJson,
    createCurriculum,
    createEvent,
    createModule,
    createSyllabus,
    eventOrder,
    moduleOrder,
    RawSyllabus,
} from "./gantt-api";

/** Export one syllabus and import it into another curriculum (#757). */

const SUITE_TAG = "e2e-syllabus-io";

type ExportDoc = { kind: string; syllabus: RawSyllabus & { title: string }; constraints: Array<unknown> };

async function exportSyllabus(request: APIRequestContext, syllabusId: string, curriculumId: string) {
    return await apiJson<ExportDoc>(
        await request.get(`/api/gantt/syllabuses/${syllabusId}/export?curriculumId=${curriculumId}`),
    );
}

async function importSyllabus(request: APIRequestContext, curriculumId: string, doc: unknown) {
    return await request.post(`/api/gantt/curriculums/${curriculumId}/import-syllabus`, { data: doc });
}

test.describe("Single-syllabus import/export (#757)", () => {
    test.describe.configure({ timeout: 120_000 });

    let source: string;
    let target: string;
    let syllabusId: string;
    let modules: Array<string>;

    test.beforeEach(async ({ request }) => {
        source = await createCurriculum(request, SUITE_TAG);
        target = await createCurriculum(request, SUITE_TAG);
        syllabusId = await createSyllabus(request, source, `${SUITE_TAG}-syllabus`);
        modules = [await createModule(request, syllabusId, "a"), await createModule(request, syllabusId, "b")];
        await createEvent(request, modules[0], "e1");
        await createEvent(request, modules[0], "e2");
    });

    test.afterEach(async ({ request }) => {
        await request.delete(`/api/gantt/curriculums/${source}`);
        await request.delete(`/api/gantt/curriculums/${target}`);
    });

    test("export marks the file as a syllabus", async ({ request }) => {
        const doc = await exportSyllabus(request, syllabusId, source);
        expect(doc.kind).toBe("bluz-syllabus");
        expect(doc.syllabus.s2m.map((r) => r.moduleId)).toEqual(modules);
    });

    test("import creates a copy in the target curriculum", async ({ request }) => {
        const doc = await exportSyllabus(request, syllabusId, source);
        const imported = await apiJson<{ id: string; title: string }>(await importSyllabus(request, target, doc));
        expect(imported.id).not.toBe(syllabusId);
        expect(imported.title).toBe(`${SUITE_TAG}-syllabus (מיובא)`);
        const curriculum = await apiJson<{ c2s: Array<{ syllabusId: string }> }>(
            await request.get(`/api/gantt/curriculums/${target}`),
        );
        expect(curriculum.c2s.map((r) => r.syllabusId)).toContain(imported.id);
    });

    test("import keeps module and event order", async ({ request }) => {
        const doc = await exportSyllabus(request, syllabusId, source);
        const { id } = await apiJson<{ id: string }>(await importSyllabus(request, target, doc));
        const newModules = await moduleOrder(request, id);
        expect(newModules).toHaveLength(2);
        expect(await eventOrder(request, newModules[0])).toHaveLength(2);
        expect(await eventOrder(request, newModules[1])).toHaveLength(0);
    });

    test("the source syllabus is untouched", async ({ request }) => {
        const doc = await exportSyllabus(request, syllabusId, source);
        await importSyllabus(request, target, doc);
        expect(await moduleOrder(request, syllabusId)).toEqual(modules);
    });

    test("importing twice makes two copies", async ({ request }) => {
        const doc = await exportSyllabus(request, syllabusId, source);
        const a = await apiJson<{ id: string }>(await importSyllabus(request, target, doc));
        const b = await apiJson<{ id: string }>(await importSyllabus(request, target, doc));
        expect(a.id).not.toBe(b.id);
    });

    test("a whole-curriculum file is rejected", async ({ request }) => {
        const curriculumDoc = await apiJson(await request.get(`/api/gantt/curriculums/${source}/export`));
        const response = await importSyllabus(request, target, curriculumDoc);
        expect((await response.json()).status).not.toBe(0);
    });

    test("an unknown curriculum is rejected", async ({ request }) => {
        const doc = await exportSyllabus(request, syllabusId, source);
        const response = await importSyllabus(request, "c_does-not-exist", doc);
        expect((await response.json()).status).not.toBe(0);
    });

    test("the dialog exports and imports", async ({ page }) => {
        await page.goto(`/gantt?gc=${source}&gs=${syllabusId}`, { waitUntil: "commit", timeout: 60_000 });
        await waitForAppLoad(page);
        const dialog = page.getByRole("dialog").filter({ hasText: "עריכת סילבוס" });
        await expect(dialog).toBeVisible({ timeout: 30_000 });

        await dialog.getByRole("button", { name: "ייבוא / ייצוא סילבוס" }).click();
        const downloadPromise = page.waitForEvent("download");
        await page.getByRole("menuitem", { name: "ייצוא הסילבוס" }).click();
        const download = await downloadPromise;
        expect(download.suggestedFilename()).toMatch(/^bluz-syllabus-.*\.json$/);
        const file = await download.path();

        await dialog.getByRole("button", { name: "ייבוא / ייצוא סילבוס" }).click();
        const chooserPromise = page.waitForEvent("filechooser");
        await page.getByRole("menuitem", { name: "ייבוא סילבוס" }).click();
        await (await chooserPromise).setFiles(file);

        await expect(dialog).toContainText("(מיובא)", { timeout: 15_000 });
        await expect(page).not.toHaveURL(new RegExp(`gs=${syllabusId}`));
    });
});
