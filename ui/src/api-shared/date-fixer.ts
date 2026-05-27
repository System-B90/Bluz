import dayjs from "dayjs";

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
            const parsedDate = new Date(value as any);
            if (Number.isNaN(parsedDate.getTime())) {
                return item;
            }
            item[fieldName] = parsedDate as any;
        } else {
            // CLIENT SIDE: Prepare for UI
            // Convert to Dayjs object for easy manipulation
            const parsedDayjs = dayjs(value as any);
            if (!parsedDayjs.isValid()) {
                return item;
            }
            item[fieldName] = parsedDayjs as any;
        }
    }
    return item;
}
