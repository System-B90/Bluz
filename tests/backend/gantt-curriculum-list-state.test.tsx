// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import dayjs from "dayjs";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import {
    CurriculumListProvider,
    curriculumListReducer,
    flattenCurriculumGroups,
    groupCurriculumsByStatus,
    initialCurriculumListState,
    useCurriculumList,
} from "@/components/gantt/state/curriculum-list";

const mockRouter = { replace: vi.fn(), push: vi.fn() };
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
    useSearchParams: () => mockSearchParams,
    usePathname: () => "/gantt",
    useRouter: () => mockRouter,
}));

vi.mock("notistack", () => ({
    useSnackbar: () => ({ enqueueSnackbar: vi.fn() }),
}));

vi.mock("@system-b90/command-palette", async (importOriginal) => {
    const actual = await importOriginal<Record<string, any>>();
    return {
        ...actual,
        useCommands: vi.fn(),
    };
});

function makeMockCurriculum(
    id: string,
    overrides?: Partial<GanttCurriculumDocument>,
): GanttCurriculumDocument {
    return {
        id: id as GanttCurriculumId,
        title: `Curriculum ${id}`,
        description: `Description ${id}`,
        color: "#123456",
        isDraft: false,
        isArchived: false,
        hoursPerDay: 8,
        daysPerWeek: 5,
        startHour: 8,
        startDate: dayjs("2026-09-01"),
        createdAt: dayjs("2026-09-01T10:00:00"),
        updatedAt: dayjs("2026-09-01T10:00:00"),
        ...overrides,
    };
}

describe("curriculumListReducer", () => {
    it("handles SET_LOADING", () => {
        const state = curriculumListReducer(initialCurriculumListState, {
            type: "SET_LOADING",
            payload: false,
        });
        expect(state.isLoading).toBe(false);
    });

    it("handles SET_ERROR", () => {
        const state = curriculumListReducer(initialCurriculumListState, {
            type: "SET_ERROR",
            payload: "Boom!",
        });
        expect(state.isLoading).toBe(false);
        expect(state.error).toBe("Boom!");
    });

    it("handles SET_CURRICULUMS", () => {
        const c1 = makeMockCurriculum("c1");
        const state = curriculumListReducer(initialCurriculumListState, {
            type: "SET_CURRICULUMS",
            payload: { [c1.id]: c1 },
        });
        expect(state.isLoading).toBe(false);
        expect(state.error).toBeNull();
        expect(state.curriculums[c1.id]).toEqual(c1);
    });

    it("handles ADD_CURRICULUM", () => {
        const c1 = makeMockCurriculum("c1");
        const state = curriculumListReducer(initialCurriculumListState, {
            type: "ADD_CURRICULUM",
            payload: c1,
        });
        expect(state.curriculums[c1.id]).toEqual(c1);
    });

    it("handles REMOVE_CURRICULUM", () => {
        const c1 = makeMockCurriculum("c1");
        const c2 = makeMockCurriculum("c2");
        const startState = {
            curriculums: { [c1.id]: c1, [c2.id]: c2 },
            isLoading: false,
            error: null,
        };
        const state = curriculumListReducer(startState, {
            type: "REMOVE_CURRICULUM",
            payload: c1.id,
        });
        expect(state.curriculums[c1.id]).toBeUndefined();
        expect(state.curriculums[c2.id]).toEqual(c2);
    });

    it("handles UPDATE_CURRICULUM for title, draft, and archive statuses", () => {
        const c1 = makeMockCurriculum("c1", {
            title: "Old Title",
            isDraft: false,
            isArchived: false,
        });
        const startState = {
            curriculums: { [c1.id]: c1 },
            isLoading: false,
            error: null,
        };

        const stateWithUpdatedTitle = curriculumListReducer(startState, {
            type: "UPDATE_CURRICULUM",
            payload: {
                id: c1.id,
                updates: { title: "New Title" },
            },
        });
        expect(stateWithUpdatedTitle.curriculums[c1.id].title).toBe("New Title");

        const stateWithDraft = curriculumListReducer(stateWithUpdatedTitle, {
            type: "UPDATE_CURRICULUM",
            payload: {
                id: c1.id,
                updates: { isDraft: true },
            },
        });
        expect(stateWithDraft.curriculums[c1.id].isDraft).toBe(true);

        const stateWithArchived = curriculumListReducer(stateWithDraft, {
            type: "UPDATE_CURRICULUM",
            payload: {
                id: c1.id,
                updates: { isArchived: true },
            },
        });
        expect(stateWithArchived.curriculums[c1.id].isArchived).toBe(true);
    });
});

describe("groupCurriculumsByStatus and flattenCurriculumGroups", () => {
    it("groups curriculums into active, drafts, and archived, sorted by updatedAt desc", () => {
        const active1 = makeMockCurriculum("active1", {
            updatedAt: dayjs("2026-09-01T10:00:00"),
        });
        const active2 = makeMockCurriculum("active2", {
            updatedAt: dayjs("2026-09-02T10:00:00"),
        });
        const draft1 = makeMockCurriculum("draft1", {
            isDraft: true,
            updatedAt: dayjs("2026-09-03T10:00:00"),
        });
        const archived1 = makeMockCurriculum("archived1", {
            isArchived: true,
            updatedAt: dayjs("2026-09-04T10:00:00"),
        });

        const map = {
            [active1.id]: active1,
            [active2.id]: active2,
            [draft1.id]: draft1,
            [archived1.id]: archived1,
        };

        const groups = groupCurriculumsByStatus(map);
        expect(groups.active).toEqual([active2.id, active1.id]);
        expect(groups.drafts).toEqual([draft1.id]);
        expect(groups.archived).toEqual([archived1.id]);

        const flat = flattenCurriculumGroups(groups);
        expect(flat).toEqual([active2.id, active1.id, draft1.id, archived1.id]);
    });
});

describe("CurriculumListProvider & useCurriculumList", () => {
    afterEach(() => {
        cleanup();
        vi.clearAllMocks();
    });

    beforeEach(() => {
        mockSearchParams = new URLSearchParams();
    });

    function TestConsumer() {
        const {
            curriculums,
            currentCurriculum,
            onCreate,
            onDelete,
            updateCurriculum,
            sortedIds,
        } = useCurriculumList();

        return (
            <div>
                <div data-testid="current-curriculum">{currentCurriculum ?? "none"}</div>
                <div data-testid="curriculums-count">{Object.keys(curriculums).length}</div>
                <div data-testid="sorted-ids">{sortedIds.join(",")}</div>
                <button
                    data-testid="btn-create"
                    onClick={() =>
                        onCreate(
                            makeMockCurriculum("c3", {
                                title: "Brand New Curriculum",
                            }),
                        )
                    }
                >
                    Create
                </button>
                <button
                    data-testid="btn-delete-c1"
                    onClick={() => onDelete("c1" as GanttCurriculumId)}
                >
                    Delete C1
                </button>
                <button
                    data-testid="btn-rename-c1"
                    onClick={() =>
                        updateCurriculum("c1" as GanttCurriculumId, {
                            title: "Renamed C1",
                        })
                    }
                >
                    Rename C1
                </button>
                <div data-testid="c1-title">{curriculums["c1" as GanttCurriculumId]?.title}</div>
            </div>
        );
    }

    it("auto-selects first curriculum when none is selected", async () => {
        const c1 = makeMockCurriculum("c1");
        const c2 = makeMockCurriculum("c2");

        render(
            <CurriculumListProvider
                initialCurriculums={{ [c1.id]: c1, [c2.id]: c2 }}
            >
                <TestConsumer />
            </CurriculumListProvider>,
        );

        expect(screen.getByTestId("current-curriculum").textContent).toBe("c1");
        expect(screen.getByTestId("curriculums-count").textContent).toBe("2");
    });

    it("onCreate adds curriculum to state and selects it", async () => {
        const c1 = makeMockCurriculum("c1");

        render(
            <CurriculumListProvider
                initialCurriculums={{ [c1.id]: c1 }}
            >
                <TestConsumer />
            </CurriculumListProvider>,
        );

        expect(screen.getByTestId("current-curriculum").textContent).toBe("c1");

        act(() => {
            screen.getByTestId("btn-create").click();
        });

        expect(screen.getByTestId("current-curriculum").textContent).toBe("c3");
        expect(screen.getByTestId("curriculums-count").textContent).toBe("2");
    });

    it("onDelete removes curriculum and selects next remaining when deleted", async () => {
        const c1 = makeMockCurriculum("c1");
        const c2 = makeMockCurriculum("c2");

        render(
            <CurriculumListProvider
                initialCurriculums={{ [c1.id]: c1, [c2.id]: c2 }}
            >
                <TestConsumer />
            </CurriculumListProvider>,
        );

        expect(screen.getByTestId("current-curriculum").textContent).toBe("c1");

        act(() => {
            screen.getByTestId("btn-delete-c1").click();
        });

        expect(screen.getByTestId("curriculums-count").textContent).toBe("1");
        expect(screen.getByTestId("current-curriculum").textContent).toBe("c2");
    });

    it("updateCurriculum updates curriculum title and flags in state", async () => {
        const c1 = makeMockCurriculum("c1", { title: "Original C1" });

        render(
            <CurriculumListProvider
                initialCurriculums={{ [c1.id]: c1 }}
            >
                <TestConsumer />
            </CurriculumListProvider>,
        );

        expect(screen.getByTestId("c1-title").textContent).toBe("Original C1");

        act(() => {
            screen.getByTestId("btn-rename-c1").click();
        });

        expect(screen.getByTestId("c1-title").textContent).toBe("Renamed C1");
    });
});
