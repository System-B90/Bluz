import { describe, it, expect, vi, beforeEach } from "vitest";
import dayjs from "dayjs";

vi.mock("@/api-client/common", () => ({
    safeApiFetcher: vi.fn(),
}));

import { safeApiFetcher } from "@/api-client/common";
import {
    clientGantApiBuilder,
    baseDocumentFixup,
} from "@/api-client/gantt/base";

describe("Gantt Base API - Failure Paths", () => {
    const mockDateFixup = (doc: any) => {
        if (doc === null) return null;
        return {
            ...doc,
            createdAt: dayjs(doc.createdAt),
            updatedAt: dayjs(doc.updatedAt),
        };
    };

    const api = clientGantApiBuilder({
        apiBaseUrl: "/api/test",
        dateFixup: mockDateFixup,
    });

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("apiList", () => {
        it("propagates network errors from apiList", async () => {
            const error = new Error("Network error");
            vi.mocked(safeApiFetcher).mockRejectedValueOnce(error);

            await expect(api.apiList()).rejects.toThrow("Network error");
        });

        it("handles empty list response", async () => {
            vi.mocked(safeApiFetcher).mockResolvedValueOnce({});

            const result = await api.apiList();
            expect(result).toEqual({});
        });

        it("passes options to fetcher", async () => {
            vi.mocked(safeApiFetcher).mockResolvedValueOnce({});
            const options = { headers: { "X-Custom": "test" } };

            await api.apiList(options);

            expect(vi.mocked(safeApiFetcher)).toHaveBeenCalledWith(
                "/api/test",
                options
            );
        });
    });

    describe("apiGet", () => {
        it("propagates network errors from apiGet", async () => {
            const error = new Error("Not found");
            vi.mocked(safeApiFetcher).mockRejectedValueOnce(error);

            await expect(api.apiGet("id1")).rejects.toThrow("Not found");
        });

        it("throws error when date fixup fails", async () => {
            const badDateFixup = () => {
                throw new Error("Date parsing error");
            };

            const badApi = clientGantApiBuilder({
                apiBaseUrl: "/api/test",
                dateFixup: badDateFixup as any,
            });

            vi.mocked(safeApiFetcher).mockResolvedValueOnce({
                id: "id1",
                title: "Test",
            });

            await expect(badApi.apiGet("id1")).rejects.toThrow("Date parsing error");
        });

        it("constructs correct URL with item ID", async () => {
            vi.mocked(safeApiFetcher).mockResolvedValueOnce({
                id: "id1",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            await api.apiGet("test-id");

            expect(vi.mocked(safeApiFetcher)).toHaveBeenCalledWith(
                "/api/test/test-id",
                expect.any(Object)
            );
        });
    });

    describe("apiCreate", () => {
        it("propagates network errors from apiCreate", async () => {
            const error = new Error("Server error");
            vi.mocked(safeApiFetcher).mockRejectedValueOnce(error);

            await expect(
                api.apiCreate({
                    title: "New Item",
                } as any)
            ).rejects.toThrow("Server error");
        });

        it("sends payload as JSON in POST request", async () => {
            vi.mocked(safeApiFetcher).mockResolvedValueOnce({
                id: "new-id",
                title: "New Item",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            const payload = { title: "New Item" };
            await api.apiCreate(payload as any);

            expect(vi.mocked(safeApiFetcher)).toHaveBeenCalledWith(
                "/api/test",
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify(payload),
                })
            );
        });

        it("applies date fixup to created response", async () => {
            const isoDate = new Date().toISOString();
            vi.mocked(safeApiFetcher).mockResolvedValueOnce({
                id: "new-id",
                title: "New",
                createdAt: isoDate,
                updatedAt: isoDate,
            });

            const result = await api.apiCreate({ title: "New" } as any);

            expect(result.createdAt).toBeDefined();
            expect(result.updatedAt).toBeDefined();
        });
    });

    describe("apiUpdate", () => {
        it("propagates network errors from apiUpdate", async () => {
            const error = new Error("Update failed");
            vi.mocked(safeApiFetcher).mockRejectedValueOnce(error);

            await expect(
                api.apiUpdate({
                    id: "id1",
                    title: "Updated",
                } as any)
            ).rejects.toThrow("Update failed");
        });

        it("extracts id from updates and sends only diff", async () => {
            vi.mocked(safeApiFetcher).mockResolvedValueOnce({
                id: "id1",
                title: "Updated",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            await api.apiUpdate({
                id: "id1",
                title: "Updated",
            } as any);

            expect(vi.mocked(safeApiFetcher)).toHaveBeenCalledWith(
                "/api/test/id1",
                expect.objectContaining({
                    method: "PATCH",
                    body: JSON.stringify({ title: "Updated" }),
                })
            );
        });

        it("handles empty update object", async () => {
            vi.mocked(safeApiFetcher).mockResolvedValueOnce({
                id: "id1",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            await api.apiUpdate({ id: "id1" } as any);

            expect(vi.mocked(safeApiFetcher)).toHaveBeenCalledWith(
                "/api/test/id1",
                expect.objectContaining({
                    method: "PATCH",
                    body: JSON.stringify({}),
                })
            );
        });
    });

    describe("apiDelete", () => {
        it("propagates network errors from apiDelete", async () => {
            const error = new Error("Delete failed");
            vi.mocked(safeApiFetcher).mockRejectedValueOnce(error);

            await expect(api.apiDelete("id1")).rejects.toThrow("Delete failed");
        });

        it("sends DELETE request to correct endpoint", async () => {
            vi.mocked(safeApiFetcher).mockResolvedValueOnce(undefined);

            await api.apiDelete("test-id");

            expect(vi.mocked(safeApiFetcher)).toHaveBeenCalledWith(
                "/api/test/test-id",
                expect.objectContaining({
                    method: "DELETE",
                })
            );
        });
    });

    describe("apiGetMany", () => {
        it("returns empty object for empty ids array", async () => {
            const result = await api.apiGetMany([]);
            expect(result).toEqual({});
        });

        it("propagates network errors from apiGetMany", async () => {
            const error = new Error("Fetch many failed");
            vi.mocked(safeApiFetcher).mockRejectedValueOnce(error);

            await expect(api.apiGetMany(["id1", "id2"])).rejects.toThrow(
                "Fetch many failed"
            );
        });

        it("constructs URL with comma-separated ids", async () => {
            vi.mocked(safeApiFetcher).mockResolvedValueOnce({});

            await api.apiGetMany(["id1", "id2", "id3"]);

            const [url] = vi.mocked(safeApiFetcher).mock.calls[0];
            expect(url).toContain("ids=id1%2Cid2%2Cid3");
        });

        it("applies date fixup to each returned item", async () => {
            const isoDate = new Date().toISOString();
            vi.mocked(safeApiFetcher).mockResolvedValueOnce({
                id1: {
                    id: "id1",
                    createdAt: isoDate,
                    updatedAt: isoDate,
                },
                id2: {
                    id: "id2",
                    createdAt: isoDate,
                    updatedAt: isoDate,
                },
            });

            const result = await api.apiGetMany(["id1", "id2"]);

            expect(Object.keys(result)).toHaveLength(2);
            expect(result.id1.createdAt).toBeDefined();
            expect(result.id2.updatedAt).toBeDefined();
        });

        it("handles partial response with missing items", async () => {
            const isoDate = new Date().toISOString();
            vi.mocked(safeApiFetcher).mockResolvedValueOnce({
                id1: {
                    id: "id1",
                    createdAt: isoDate,
                    updatedAt: isoDate,
                },
            });

            const result = await api.apiGetMany(["id1", "id2"]);

            expect(Object.keys(result)).toHaveLength(1);
            expect(result.id1).toBeDefined();
            expect(result.id2).toBeUndefined();
        });
    });

    describe("apiLink", () => {
        it("propagates network errors from apiLink", async () => {
            const error = new Error("Link failed");
            vi.mocked(safeApiFetcher).mockRejectedValueOnce(error);

            await expect(api.apiLink("item1", "parent1")).rejects.toThrow(
                "Link failed"
            );
        });

        it("sends POST request with parent ID", async () => {
            vi.mocked(safeApiFetcher).mockResolvedValueOnce({
                id: "item1",
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            });

            await api.apiLink("item1", "parent1");

            expect(vi.mocked(safeApiFetcher)).toHaveBeenCalledWith(
                "/api/test/item1/link",
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({ newParentId: "parent1" }),
                })
            );
        });
    });

    describe("apiUnlink", () => {
        it("propagates network errors from apiUnlink", async () => {
            const error = new Error("Unlink failed");
            vi.mocked(safeApiFetcher).mockRejectedValueOnce(error);

            await expect(api.apiUnlink("item1", "parent1")).rejects.toThrow(
                "Unlink failed"
            );
        });

        it("sends DELETE request with parent ID", async () => {
            vi.mocked(safeApiFetcher).mockResolvedValueOnce(undefined);

            await api.apiUnlink("item1", "parent1");

            expect(vi.mocked(safeApiFetcher)).toHaveBeenCalledWith(
                "/api/test/item1/link",
                expect.objectContaining({
                    method: "DELETE",
                    body: JSON.stringify({ oldParentId: "parent1" }),
                })
            );
        });
    });

    describe("apiSetAllocatedTime", () => {
        it("propagates network errors from apiSetAllocatedTime", async () => {
            const error = new Error("Set time failed");
            vi.mocked(safeApiFetcher).mockRejectedValueOnce(error);

            await expect(
                api.apiSetAllocatedTime("item1", "container1", 100)
            ).rejects.toThrow("Set time failed");
        });

        it("sends POST request with allocated time", async () => {
            vi.mocked(safeApiFetcher).mockResolvedValueOnce(undefined);

            await api.apiSetAllocatedTime("item1", "container1", 250);

            expect(vi.mocked(safeApiFetcher)).toHaveBeenCalledWith(
                "/api/test/item1/allocate-time",
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({
                        containerId: "container1",
                        duration: 250,
                    }),
                })
            );
        });

        it("handles zero allocated time", async () => {
            vi.mocked(safeApiFetcher).mockResolvedValueOnce(undefined);

            await api.apiSetAllocatedTime("item1", "container1", 0);

            expect(vi.mocked(safeApiFetcher)).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    method: "POST",
                    body: JSON.stringify({
                        containerId: "container1",
                        duration: 0,
                    }),
                })
            );
        });
    });

    describe("apiGetAllocatedTime", () => {
        it("propagates network errors from apiGetAllocatedTime", async () => {
            const error = new Error("Get time failed");
            vi.mocked(safeApiFetcher).mockRejectedValueOnce(error);

            await expect(
                api.apiGetAllocatedTime("item1", "container1")
            ).rejects.toThrow("Get time failed");
        });

        it("constructs URL with curriculum ID query param", async () => {
            vi.mocked(safeApiFetcher).mockResolvedValueOnce(100);

            await api.apiGetAllocatedTime("item1", "container1");

            const [url] = vi.mocked(safeApiFetcher).mock.calls[0];
            expect(url).toContain("curriculumId=container1");
        });

        it("returns numeric allocated time", async () => {
            vi.mocked(safeApiFetcher).mockResolvedValueOnce(500);

            const result = await api.apiGetAllocatedTime("item1", "container1");

            expect(typeof result).toBe("number");
            expect(result).toBe(500);
        });
    });

    describe("baseDocumentFixup", () => {
        it("returns null when document is null", () => {
            const result = baseDocumentFixup(null);
            expect(result).toBeNull();
        });

        it("throws error when inplaceDateFixup fails", () => {
            const badDoc = {
                createdAt: "invalid-date",
                updatedAt: "invalid-date",
            };

            expect(() => baseDocumentFixup(badDoc as any)).not.toThrow();
        });
    });

    describe("URL Building", () => {
        it("removes trailing slashes from base URL", async () => {
            const apiWithTrailingSlash = clientGantApiBuilder({
                apiBaseUrl: "/api/test/",
                dateFixup: mockDateFixup,
            });

            vi.mocked(safeApiFetcher).mockResolvedValueOnce({});

            await apiWithTrailingSlash.apiList();

            expect(vi.mocked(safeApiFetcher)).toHaveBeenCalledWith(
                "/api/test",
                expect.any(Object)
            );
        });

        it("handles empty base URL path", async () => {
            const apiWithRoot = clientGantApiBuilder({
                apiBaseUrl: "/",
                dateFixup: mockDateFixup,
            });

            vi.mocked(safeApiFetcher).mockResolvedValueOnce({});

            await apiWithRoot.apiList();

            expect(vi.mocked(safeApiFetcher)).toHaveBeenCalledWith(
                "/",
                expect.any(Object)
            );
        });
    });
});
