import { MutableRefObject, createContext, useContext } from "react";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";

export type CurriculumSyncHandler = (curriculum: GanttCurriculumDocument) => void;

/**
 * Lets curriculum-status actions rendered outside the FAB (e.g. the syllabus
 * tab's about card) push updates into the FAB's own curriculum list cache,
 * so draft/archive changes made there are reflected in the FAB's grouping.
 */
export const CurriculumSyncContext =
    createContext<MutableRefObject<CurriculumSyncHandler> | null>(null);

export function useCurriculumSyncRef() {
    return useContext(CurriculumSyncContext);
}
