import { ListItem, ListItemButton, Skeleton } from "@mui/material";
import { Dispatch, SetStateAction } from "react";

import { CurriculumDocument } from "@/api-client/gant/curriculum";
import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { CurriculumEntry } from "@/components/gant/curriculum-fab/CurriculumEntry";

export interface CurriculumListItemsProps
{
    isFetchingDetails: boolean;
    curriculumsData: Record<CurriculumId, CurriculumDocument>;
    sortedIds: Array<CurriculumId>;
    setCurrentCurriculum: Dispatch<SetStateAction<CurriculumId | null>>;
    currentCurriculum?: CurriculumId | null;
}

export function CurriculumListItems({ isFetchingDetails, curriculumsData, sortedIds, setCurrentCurriculum, currentCurriculum }: CurriculumListItemsProps)
{
    if (isFetchingDetails)
    {
        // Default to 3 skeletons while doing the initial double-fetch
        const skeletonCount = Object.keys(curriculumsData).length || 3;

        return Array.from({ length: skeletonCount }).map((_, index) => (
            <ListItem disablePadding key={ `skeleton-${index}` }>
                <ListItemButton disabled>
                    <Skeleton height={ 28 } variant="text" width="80%" />
                </ListItemButton>
            </ListItem>
        ));
    }

    return sortedIds.map(id =>
    {
        const curriculum = curriculumsData[ id ];
        if (!curriculum) return null;

        return (
            <CurriculumEntry
                curriculum={ curriculum }
                key={ id }
                onClick={ () => setCurrentCurriculum(id) }
                selected={ currentCurriculum === id }
            />
        );
    });
}
