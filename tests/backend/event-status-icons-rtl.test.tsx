// @vitest-environment jsdom

import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { EventStatusIcons } from "@/components/schedule/event-component/EventStatusIcons";
import { Event } from "@/components/schedule/types/event";

const EVENT = { id: "e1", locked: true, required: true } as unknown as Event;

afterEach(cleanup);

/**
 * The status icons sit in a Hebrew, right-to-left UI. Their container has to
 * keep `direction: rtl` even when the caller passes its own `sx` — which is
 * exactly what UnifiedEvent does when it pins them to a corner.
 */
describe("EventStatusIcons direction (#620)", () => {
    it("keeps direction rtl when the caller passes no sx", () => {
        const { container } = render(
            <EventStatusIcons event={EVENT} size="small" />,
        );

        const box = container.firstElementChild as HTMLElement;
        expect(getComputedStyle(box).direction).toBe("rtl");
    });

    it("keeps direction rtl when the caller passes its own sx", () => {
        // The caller's sx used to be re-applied after the rtl override by a
        // trailing `{...props}` spread, silently reverting the icons to LTR.
        const { container } = render(
            <EventStatusIcons
                event={EVENT}
                size="small"
                sx={{ position: "absolute", insetInlineEnd: 2 }}
            />,
        );

        const box = container.firstElementChild as HTMLElement;
        const style = getComputedStyle(box);
        expect(style.direction).toBe("rtl");
        // The caller's own styling still has to survive the merge.
        expect(style.position).toBe("absolute");
    });
});
