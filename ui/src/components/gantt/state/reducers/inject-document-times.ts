import dayjs from "dayjs";

import { BaseDocument } from "@/api-client/gantt/base";
import { BaseGantItem } from "@/api-shared/types/gantt/models";

export function injectDocumentTimes<T extends BaseGantItem>(
    rawDoc: T,
): T & BaseDocument {
    return { ...rawDoc, createdAt: dayjs(), updatedAt: dayjs() };
}
