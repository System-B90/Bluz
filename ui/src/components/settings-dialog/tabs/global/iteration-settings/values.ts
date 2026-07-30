import { Iteration } from "@/api-shared/types/iteration";
import { ValidationResult } from "@/components/settings-dialog/tabs/global/common/UseEntityForm";

/** Date/string → yyyy-mm-dd for a native date input; "" when unset/invalid. */
export function toDateInputValue(
    value: Date | null | string | undefined,
): string {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toISOString().slice(0, 10);
}

export type IterationValues = {
    id: string;
    label: string;
    hiveUrl: string;
    startDate: string;
    endDate: string;
};

export const EMPTY_ITERATION_VALUES: IterationValues = {
    id: "",
    label: "",
    hiveUrl: "",
    startDate: "",
    endDate: "",
};

export function iterationToValues(iteration: Iteration): IterationValues {
    return {
        id: iteration.id,
        label: iteration.label,
        hiveUrl: iteration.hiveUrl ?? "",
        startDate: toDateInputValue(iteration.startDate),
        endDate: toDateInputValue(iteration.endDate),
    };
}

/**
 * Both fields are always required. The id is only *typed* when creating — on
 * an existing iteration it is populated and read-only — so there is no need
 * to know the form's mode here.
 */
export function validateIteration(values: IterationValues): ValidationResult {
    if (!values.label.trim() || !values.id.trim()) {
        return "מזהה ושם תצוגה הם שדות חובה";
    }
    return null;
}
