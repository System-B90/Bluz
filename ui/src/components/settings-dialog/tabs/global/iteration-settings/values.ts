import { HiveCacheChanges, Iteration } from "@/api-shared/types/iteration";
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
 * Human summary of a manual Hive sync (#379). A sync that changed nothing is
 * still a result worth stating — silent success reads as a no-op.
 */
export function describeHiveSyncChanges(changes: HiveCacheChanges): string {
    const parts: Array<string> = [];
    if (changes.added > 0) parts.push(`${changes.added} נוספו`);
    if (changes.updated > 0) parts.push(`${changes.updated} עודכנו`);
    if (changes.removed > 0) parts.push(`${changes.removed} הוסרו`);
    if (parts.length === 0) {
        return "פרטי ההייב כבר היו מעודכנים — אין שינויים";
    }
    return `פרטי ההייב סונכרנו: ${parts.join(", ")}`;
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
