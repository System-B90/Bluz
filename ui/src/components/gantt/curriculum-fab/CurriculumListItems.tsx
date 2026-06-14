import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import Skeleton from "@mui/material/Skeleton";
import { Dispatch, SetStateAction } from "react";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { CurriculumEntry } from "@/components/gantt/curriculum-fab/CurriculumEntry";

export type CurriculumListItemsProps = {
  isFetchingDetails: boolean;
  curriculumsData: Record<GanttCurriculumId, GanttCurriculumDocument>;
  sortedIds: Array<GanttCurriculumId>;
  setCurrentCurriculum: Dispatch<SetStateAction<GanttCurriculumId | null>>;
  currentCurriculum?: GanttCurriculumId | null;
};

export function CurriculumListItems({
    isFetchingDetails,
    curriculumsData,
    sortedIds,
    setCurrentCurriculum,
    currentCurriculum,
}: CurriculumListItemsProps) {
    if (isFetchingDetails) {
    // Default to 3 skeletons while doing the initial double-fetch
        const skeletonCount = Object.keys(curriculumsData).length || 3;

        return Array.from({ length: skeletonCount }).map((_, index) => (
            <ListItem disablePadding key={`skeleton-${index}`}>
                <ListItemButton disabled>
                    <Skeleton height={28} variant="text" width="80%" />
                </ListItemButton>
            </ListItem>
        ));
    }

    return sortedIds.map((id) => {
        const curriculum = curriculumsData[id];
        if (!curriculum) return null;

        return (
            <CurriculumEntry
                curriculum={curriculum}
                key={id}
                onClick={() => setCurrentCurriculum(id)}
                selected={currentCurriculum === id}
            />
        );
    });
}
