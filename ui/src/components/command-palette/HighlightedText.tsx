"use client";
import Box from "@mui/material/Box";
import { Fragment, useMemo } from "react";

export type HighlightedTextProps = {
    text: string;
    /** Indices into `text` to emphasise. Order-insensitive. */
    indices: Array<number>;
};

/**
 * Render `text` with the matched characters emphasised, so users can see *why*
 * a result matched. Contiguous matched indices are merged into a single span to
 * keep the DOM small and, more importantly, to avoid splitting an RTL word into
 * many inline boxes — which would visually scramble its letter order.
 */
export function HighlightedText({ text, indices }: HighlightedTextProps) {
    const segments = useMemo(() => {
        if (indices.length === 0) return [{ text, match: false }];

        const matched = new Set(indices);
        const result: Array<{ text: string; match: boolean }> = [];

        for (let i = 0; i < text.length; i++) {
            const isMatch = matched.has(i);
            const last = result[result.length - 1];
            if (last && last.match === isMatch) {
                last.text += text[i];
            } else {
                result.push({ text: text[i], match: isMatch });
            }
        }

        return result;
    }, [text, indices]);

    return (
        <>
            {segments.map((segment, index) =>
                segment.match ? (
                    <Box
                        component="mark"
                        key={index}
                        sx={{
                            bgcolor: "transparent",
                            color: "primary.main",
                            fontWeight: 800,
                        }}
                    >
                        {segment.text}
                    </Box>
                ) : (
                    <Fragment key={index}>{segment.text}</Fragment>
                ),
            )}
        </>
    );
}
