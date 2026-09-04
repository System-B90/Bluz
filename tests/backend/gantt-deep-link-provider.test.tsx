// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The `?ge=` deep link (#576). One param now drives both the jump from the
 * schedule event dialog and the event dialog's own refresh-persistence, and
 * landing on it must open the module dialog with the event dialog on top —
 * the same state clicking the event from inside an open module produces.
 */

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
    useSearchParams: () => searchParams,
    usePathname: () => "/gantt",
    useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock("@/components/gantt/module-dialog", () => ({
    ModuleDialog: (props: {
        open: boolean;
        moduleId: null | string;
        syllabusId: null | string;
        focusEventId: null | string;
    }) => (
        <div
            data-focus={ props.focusEventId ?? "" }
            data-module={ props.moduleId ?? "" }
            data-syllabus={ props.syllabusId ?? "" }
            data-testid={ props.open ? "module-dialog-open" : "module-dialog" }
        />
    ),
}));
vi.mock("@/components/gantt/event-dialog", () => ({
    EventDialog: (props: {
        open: boolean;
        eventId: null | string;
        moduleId: null | string;
    }) => (
        <div
            data-event={ props.eventId ?? "" }
            data-module={ props.moduleId ?? "" }
            data-testid={ props.open ? "event-dialog-open" : "event-dialog" }
        />
    ),
}));
vi.mock("@/components/gantt/state/execution/Provider", () => ({
    GanttExecutionProvider: ({ children }: { children: React.ReactNode }) => (
        <>{ children }</>
    ),
}));

import { ApiCurriculum } from "@/api-shared/types/gantt/api-layer";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import {
    CurriculumProvider,
    GANTT_EVENT_DEEP_LINK_PARAM,
} from "@/components/gantt/state/provider";

const initialData = {
    id: "c1",
    title: "גאנט",
    c2s: [
        {
            syllabus: {
                id: "s1",
                title: "סילבוס",
                s2m: [
                    {
                        module: {
                            id: "m1",
                            title: "מודול",
                            m2e: [ { event: { id: "e1", title: "אירוע" } } ],
                        },
                    },
                ],
            },
        },
    ],
    c2w: [],
} as unknown as ApiCurriculum;

function renderProvider(query: string) {
    searchParams = new URLSearchParams(query);
    window.history.replaceState(null, "", `/gantt?${query}`);
    return render(
        <CurriculumProvider
            curriculumId={ "c1" as GanttCurriculumId }
            initialData={ initialData }
        >
            <div>content</div>
        </CurriculumProvider>,
    );
}

beforeEach(() => {
    window.history.replaceState(null, "", "/gantt");
});
afterEach(cleanup);

describe("gantt ?ge= deep link", () => {
    it("uses the shared param name", () => {
        expect(GANTT_EVENT_DEEP_LINK_PARAM).toBe("ge");
    });

    it("opens the module dialog with the event dialog on top", async () => {
        renderProvider("ge=e1");

        await waitFor(() => {
            expect(screen.getByTestId("event-dialog-open")).toBeDefined();
        });

        const moduleDialog = screen.getByTestId("module-dialog-open");
        expect(moduleDialog.dataset.module).toBe("m1");
        expect(moduleDialog.dataset.syllabus).toBe("s1");
        expect(moduleDialog.dataset.focus).toBe("e1");

        const eventDialog = screen.getByTestId("event-dialog-open");
        expect(eventDialog.dataset.event).toBe("e1");
        expect(eventDialog.dataset.module).toBe("m1");
    });

    it("opens nothing without the param", async () => {
        renderProvider("");

        await waitFor(() => {
            expect(screen.getByTestId("event-dialog")).toBeDefined();
        });
        expect(screen.queryByTestId("module-dialog-open")).toBeNull();
    });

    it("ignores an id that is not in this curriculum", async () => {
        renderProvider("ge=nope");

        await waitFor(() => {
            expect(screen.getByTestId("event-dialog")).toBeDefined();
        });
        expect(screen.queryByTestId("event-dialog-open")).toBeNull();
    });

    it("strips a stale ?ge= from the URL when nothing opens", async () => {
        renderProvider("ge=nope");

        await waitFor(() => {
            expect(new URLSearchParams(window.location.search).get("ge")).toBeNull();
        });
        expect(window.location.pathname).toBe("/gantt");
    });

    it("keeps unrelated params while rewriting the URL", async () => {
        renderProvider("cid=c1&it=2026-a&ge=nope");

        await waitFor(() => {
            const params = new URLSearchParams(window.location.search);
            expect(params.get("ge")).toBeNull();
            expect(params.get("cid")).toBe("c1");
            expect(params.get("it")).toBe("2026-a");
        });
    });

    it("keeps ?ge= in the URL while the event dialog is open", async () => {
        renderProvider("ge=e1");

        await waitFor(() => {
            expect(screen.getByTestId("event-dialog-open")).toBeDefined();
        });
        expect(new URLSearchParams(window.location.search).get("ge")).toBe(
            "e1",
        );
    });
});
