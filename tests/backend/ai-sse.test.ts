import { describe, expect, it } from "vitest";

/**
 * Unit tests for the shared SSE framing. The interesting property is not that
 * a well-formed stream parses — it is that a stream chopped at hostile
 * boundaries still produces exactly the same frames, since a network chunk can
 * end anywhere and getting that wrong drops frames only under load.
 */

import { encodeSseEvent, readSseData, SSE_DONE_SENTINEL } from "@/api-shared/sse";

/** Builds a body stream that emits exactly the given chunks, in order. */
function streamOf(chunks: Array<string>): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
        start(controller) {
            for (const chunk of chunks) {
                controller.enqueue(encoder.encode(chunk));
            }
            controller.close();
        },
    });
}

async function collect(chunks: Array<string>): Promise<Array<string>> {
    const payloads: Array<string> = [];
    for await (const payload of readSseData(streamOf(chunks))) {
        payloads.push(payload);
    }
    return payloads;
}

describe("readSseData", () => {
    it("yields the payload of each data line", async () => {
        expect(await collect(['data: {"a":1}\n\n', 'data: {"b":2}\n\n'])).toEqual([
            '{"a":1}',
            '{"b":2}',
        ]);
    });

    it("reassembles a frame split across chunks", async () => {
        // The split lands mid-JSON, which is the case a naive
        // "parse each chunk" reader silently drops.
        expect(await collect(['data: {"a"', ':1}\n\n'])).toEqual(['{"a":1}']);
    });

    it("reassembles a frame split inside the data prefix", async () => {
        expect(await collect(["da", "ta: ", '{"a":1}', "\n\n"])).toEqual([
            '{"a":1}',
        ]);
    });

    it("emits nothing for a frame with no terminating newline", async () => {
        // A truncated tail is incomplete, not a frame: emitting it would hand
        // the consumer half a JSON document.
        expect(await collect(['data: {"a":1}'])).toEqual([]);
    });

    it("skips comment keep-alive lines", async () => {
        expect(
            await collect([": OPENROUTER PROCESSING\n", 'data: {"a":1}\n\n']),
        ).toEqual(['{"a":1}']);
    });

    it("skips blank lines between frames", async () => {
        expect(await collect(['data: {"a":1}\n\n\n\ndata: {"b":2}\n\n'])).toEqual([
            '{"a":1}',
            '{"b":2}',
        ]);
    });

    it("stops at the done sentinel and ignores anything after it", async () => {
        expect(
            await collect([
                'data: {"a":1}\n\n',
                `data: ${SSE_DONE_SENTINEL}\n\n`,
                'data: {"never":true}\n\n',
            ]),
        ).toEqual(['{"a":1}']);
    });

    it("survives a multi-byte character split across chunks", async () => {
        // Hebrew content is the norm here, and a UTF-8 sequence split mid-rune
        // decodes to a replacement character unless the decoder is streaming.
        const encoded = new TextEncoder().encode('data: {"t":"שלום"}\n\n');
        const stream = new ReadableStream<Uint8Array>({
            start(controller) {
                controller.enqueue(encoded.slice(0, 12));
                controller.enqueue(encoded.slice(12));
                controller.close();
            },
        });

        const payloads: Array<string> = [];
        for await (const payload of readSseData(stream)) payloads.push(payload);
        expect(JSON.parse(payloads[0]).t).toBe("שלום");
    });

    it("releases the reader lock when the consumer breaks out early", async () => {
        // Without the release the runtime cannot tear the socket down, so an
        // abandoned turn keeps the upstream request (and its billing) alive.
        const stream = streamOf(['data: {"a":1}\n\n', 'data: {"b":2}\n\n']);
        for await (const _payload of readSseData(stream)) break;
        expect(stream.locked).toBe(false);
    });
});

describe("encodeSseEvent", () => {
    it("frames an event as a data line terminated by a blank line", () => {
        expect(encodeSseEvent({ type: "delta", text: "hi" })).toBe(
            'data: {"type":"delta","text":"hi"}\n\n',
        );
    });

    it("round-trips through the reader", async () => {
        const event = { type: "delta", text: 'שלום "עולם"\nשורה' };
        expect(JSON.parse((await collect([encodeSseEvent(event)]))[0])).toEqual(
            event,
        );
    });
});
