import { dayjs } from "@/api-shared/dayjs-setup";

export function inplaceDateFixup<T>(
    item: T,
    fieldName: Array<keyof T> | keyof T,
): T {
    if (Array.isArray(fieldName)) {
        fieldName.forEach((k) => inplaceDateFixup(item, k));
    } else {
        const value = item[fieldName];
        if (!value) {
            return item;
        }

        if (typeof window === "undefined") {
            // SERVER SIDE: Prepare for MongoDB/API
            // Convert to native Date object or ISO string
            const parsedDate = new Date(value as Date | number | string);
            if (Number.isNaN(parsedDate.getTime())) {
                return item;
            }
            item[fieldName] = parsedDate as T[typeof fieldName];
        } else {
            // CLIENT SIDE: Prepare for UI
            // Convert to Dayjs object for easy manipulation
            const parsedDayjs = dayjs(value as Date | number | string);
            if (!parsedDayjs.isValid()) {
                return item;
            }
            item[fieldName] = parsedDayjs as T[typeof fieldName];
        }
    }
    return item;
}
