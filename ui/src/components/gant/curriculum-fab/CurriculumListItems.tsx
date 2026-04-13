import { CurriculumDocument } from "@/api-client/gant/curriculum";
import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { CurriculumEntry } from "@/components/gant/curriculum-fab/CurriculumEntry";
import { ListItem, ListItemButton, Skeleton } from "@mui/material";
import { Dispatch, SetStateAction } from "react";

export interface CurriculumListItemsProps
{
    isFetchingDetails: boolean;
    curriculumsData: Record<CurriculumId, CurriculumDocument>;
    sortedIds: Array<CurriculumId>;
    setCurrentCurriculum: Dispatch<SetStateAction<CurriculumId | null>>;
    currentCurriculum?: CurriculumId | null;
}

export default function CurriculumListItems({ isFetchingDetails, curriculumsData, sortedIds, setCurrentCurriculum, currentCurriculum }: CurriculumListItemsProps)
{
    if (isFetchingDetails)
    {
        // Default to 3 skeletons while doing the initial double-fetch
        const skeletonCount = Object.keys(curriculumsData).length || 3;

        return Array.from({ length: skeletonCount }).map((_, index) => (
            <ListItem key={ `skeleton-${index}` } disablePadding>
                <ListItemButton disabled>
                    <Skeleton variant="text" width="80%" height={ 28 } />
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
                key={ id }
                curriculum={ curriculum }
                onClick={ () => setCurrentCurriculum(id) }
                selected={ currentCurriculum === id }
            />
        );
    });
}
