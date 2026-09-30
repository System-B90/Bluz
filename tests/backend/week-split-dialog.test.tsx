// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
    hoursToMinutes,
    initialWeekSplitHours,
    WeekSplitDialog,
} from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/WeekSplitDialog";

afterEach(cleanup);

function renderDialog(initialParts?: Array<number>) {
    const onSave = vi.fn();
    render(
        <WeekSplitDialog
            eventTitle="ע״ע"
            initialParts={ initialParts }
            onClose={ vi.fn() }
            onSave={ onSave }
            open
            totalMinutes={ 600 }
        />,
    );
    return { onSave };
}

const fields = () => screen.getAllByRole("spinbutton") as Array<HTMLInputElement>;
const save = () => screen.getByRole("button", { name: "שמירה" });

describe("week split helpers (#768)", () => {
    it("converts typed hours to whole minutes, NaN for blanks", () => {
        expect(hoursToMinutes("2.5")).toBe(150);
        expect(Number.isNaN(hoursToMinutes(""))).toBe(true);
        expect(Number.isNaN(hoursToMinutes("abc"))).toBe(true);
    });

    it("starts from the stored split, else two halves", () => {
        expect(initialWeekSplitHours([ 180, 420 ], 600)).toEqual([ "3", "7" ]);
        expect(initialWeekSplitHours(undefined, 600)).toEqual([ "5", "5" ]);
        expect(initialWeekSplitHours([ 600 ], 600)).toEqual([ "5", "5" ]);
    });
});

describe("WeekSplitDialog (#768)", () => {
    it("saves a 3/3/4 split of a 10-hour event", () => {
        const { onSave } = renderDialog();

        fireEvent.click(screen.getByRole("button", { name: "הוספת שבוע" }));
        const [ a, b, c ] = fields();
        fireEvent.change(a, { target: { value: "3" } });
        fireEvent.change(b, { target: { value: "3" } });
        fireEvent.change(c, { target: { value: "4" } });
        fireEvent.click(save());

        expect(onSave).toHaveBeenCalledWith([ 180, 180, 240 ]);
    });

    it("blocks saving parts that do not add up to the whole", () => {
        renderDialog();

        fireEvent.change(fields()[ 0 ], { target: { value: "1" } });

        expect((save() as HTMLButtonElement).disabled).toBe(true);
    });

    it("regression: a zero-hour part cannot be saved", () => {
        renderDialog();

        fireEvent.change(fields()[ 0 ], { target: { value: "0" } });
        fireEvent.change(fields()[ 1 ], { target: { value: "10" } });

        expect((save() as HTMLButtonElement).disabled).toBe(true);
    });

    it("clears the split with an empty list", () => {
        const { onSave } = renderDialog([ 300, 300 ]);

        fireEvent.click(screen.getByRole("button", { name: "ביטול הפיצול" }));

        expect(onSave).toHaveBeenCalledWith([]);
    });

    it("keeps at least two weeks", () => {
        renderDialog();

        expect((screen.getByRole("button", { name: "הסרת שבוע 1" }) as HTMLButtonElement).disabled).toBe(true);
    });
});
