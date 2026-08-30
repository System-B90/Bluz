import { Dayjs } from "dayjs";

import { APP_TIMEZONE, dayjs } from "@/api-shared/dayjs-setup";
import { HiveCacheChanges, Iteration } from "@/api-shared/types/iteration";
import { ValidationResult } from "@/components/settings-dialog/tabs/global/common/UseEntityForm";

/**
 * Date/string → yyyy-mm-dd for a native date input; "" when unset/invalid.
 *
 * Formatted in the venue timezone, not UTC. A date-only picker stores local
 * midnight, and Asia/Jerusalem is UTC+2/+3, so slicing `toISOString()` reported
 * every iteration as starting the previous day.
 */
export function toDateInputValue(
    value: Date | null | string | undefined,
): string {
    if (!value) return "";
    const date = dayjs(value).tz(APP_TIMEZONE);
    if (!date.isValid()) return "";
    return date.format("YYYY-MM-DD");
}

export type IterationValues = {
    id: string;
    label: string;
    hiveUrl: string;
    startDate: Dayjs | null;
    endDate: Dayjs | null;
};

export const EMPTY_ITERATION_VALUES: IterationValues = {
    id: "",
    label: "",
    hiveUrl: "",
    startDate: null,
    endDate: null,
};

export function iterationToValues(iteration: Iteration): IterationValues {
    return {
        id: iteration.id,
        label: iteration.label,
        hiveUrl: iteration.hiveUrl ?? "",
        startDate: iteration.startDate ? dayjs(iteration.startDate) : null,
        endDate: iteration.endDate ? dayjs(iteration.endDate) : null,
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
    if (
        values.startDate &&
        values.endDate &&
        values.startDate.isValid() &&
        values.endDate.isValid() &&
        !values.endDate.isAfter(values.startDate)
    ) {
        return "תאריך הסיום חייב להיות אחרי תאריך ההתחלה";
    }
    return null;
}
