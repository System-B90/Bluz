// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useAiFabSlotTaken, useReserveAiFabSlot } from "@/components/ai/fab-slot";

/** The AI launcher sits at the page bottom unless a FAB (the gantt's) is under it. */
function Launcher() {
    return <span data-testid="slot">{useAiFabSlotTaken() ? "raised" : "bottom"}</span>;
}

function GanttFab() {
    useReserveAiFabSlot();
    return null;
}

function Page({ fabs }: { fabs: number }) {
    return (
        <>
            <Launcher />
            {Array.from({ length: fabs }, (_, i) => <GanttFab key={i} />)}
        </>
    );
}

describe("AI FAB slot", () => {
    afterEach(cleanup);

    it("sits at the bottom with no FAB under it, and rises while one is mounted", () => {
        const { rerender } = render(<Page fabs={0} />);
        expect(screen.getByTestId("slot").textContent).toBe("bottom");

        act(() => rerender(<Page fabs={1} />));
        expect(screen.getByTestId("slot").textContent).toBe("raised");

        act(() => rerender(<Page fabs={0} />));
        expect(screen.getByTestId("slot").textContent).toBe("bottom");
    });

    it("stays raised until the last reservation is released", () => {
        const { rerender, unmount } = render(<Page fabs={2} />);
        act(() => rerender(<Page fabs={1} />));
        expect(screen.getByTestId("slot").textContent).toBe("raised");
        unmount();
    });
});
