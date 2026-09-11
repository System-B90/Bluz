import { createContext, Dispatch, SetStateAction } from "react";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import {
    CurriculumGroups,
    CurriculumListAction,
    CurriculumListState,
} from "@/components/gantt/state/curriculum-list/types";

export type CurriculumListContextType = {
    state: CurriculumListState;
    curriculums: Record<GanttCurriculumId, GanttCurriculumDocument>;
    isLoading: boolean;
    error: null | string;
    groups: CurriculumGroups;
    sortedIds: Array<GanttCurriculumId>;
    currentCurriculum: GanttCurriculumId | null;
    setCurrentCurriculum: Dispatch<SetStateAction<GanttCurriculumId | null>>;
    onCreate: (newCurriculum: GanttCurriculumDocument) => void;
    onDelete: (deletedCurriculumId: GanttCurriculumId) => void;
    updateCurriculum: (
        id: GanttCurriculumId,
        updates: Partial<GanttCurriculumDocument>,
    ) => void;
    refreshCurriculums: () => Promise<void>;
    dispatch: Dispatch<CurriculumListAction>;
};

export const CurriculumListContext = createContext<
    CurriculumListContextType | undefined
>(undefined);
