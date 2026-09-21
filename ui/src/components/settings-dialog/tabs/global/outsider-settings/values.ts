import dayjs, { Dayjs } from "dayjs";

import { Outsider } from "@/api-shared/types/outsider";
import { ValidationResult } from "@/components/settings-dialog/tabs/global/common/UseEntityForm";

/**
 * The outsider form's fields as one value bag, so the tab passes a single
 * object down instead of drilling twelve value/setter pairs. See #191.
 */
export type OutsiderValues = {
    name: string;
    phone: string;
    personalNumber: string;
    idNumber: string;
    releaseDate: Dayjs | null;
    comment: string;
};

export const EMPTY_OUTSIDER_VALUES: OutsiderValues = {
    name: "",
    phone: "",
    personalNumber: "",
    idNumber: "",
    releaseDate: null,
    comment: "",
};

const PHONE_PATTERN = /^\+?[0-9\s-]{7,20}$/;

export const isPhoneValid = (phone: string) =>
    !phone || PHONE_PATTERN.test(phone);

export function outsiderToValues(outsider: Outsider): OutsiderValues {
    return {
        name: outsider.name,
        phone: outsider.phone,
        personalNumber: outsider.personalNumber ?? "",
        idNumber: outsider.idNumber ?? "",
        releaseDate: outsider.releaseDate ? dayjs(outsider.releaseDate) : null,
        comment: outsider.comment ?? "",
    };
}

export function validateOutsider(values: OutsiderValues): ValidationResult {
    if (!values.name.trim()) return "שם איש חוץ הוא שדה חובה";
    if (!values.phone.trim()) return "מספר טלפון הוא שדה חובה";
    if (!isPhoneValid(values.phone)) return "מספר טלפון לא תקין";
    return null;
}

/**
 * Maps the form values onto the API payload, trimming blanks to `null`.
 *
 * `null` rather than `undefined` on purpose: the server applies the payload
 * as a plain `$set`, and `JSON.stringify` drops `undefined` keys entirely, so
 * a field the user cleared would silently keep its old value on the server.
 */
export function outsiderValuesToPayload(values: OutsiderValues) {
    return {
        comment: values.comment.trim() || null,
        idNumber: values.idNumber.trim() || null,
        name: values.name.trim(),
        personalNumber: values.personalNumber.trim() || null,
        phone: values.phone.trim(),
        releaseDate:
            values.releaseDate && values.releaseDate.isValid()
                ? values.releaseDate.toISOString()
                : null,
    };
}
