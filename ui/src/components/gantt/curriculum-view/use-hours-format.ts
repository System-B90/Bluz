import { useSyncExternalStore } from "react";

import { getHoursFormat, subscribeHoursFormat } from "@/components/gantt/curriculum-view/gantt-time-utils";

/** Re-renders the caller when the viewer switches decimal/clock hours. */
export const useHoursFormat = () =>
    useSyncExternalStore(subscribeHoursFormat, getHoursFormat, () => "decimal" as const);
