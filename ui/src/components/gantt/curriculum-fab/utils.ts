import { EnqueueSnackbar } from "notistack";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { ganttApi } from "@/api-client/gantt";
import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/curriculum";

export function sortCurriculumsByDraftAndUpdatedAt(curriculums: Record<GanttCurriculumId, GanttCurriculumDocument>): Array<GanttCurriculumId>
{
    return (Object.keys(curriculums) as GanttCurriculumId[]).sort((a, b) =>
    {
        const dataA = curriculums[ a ];
        const dataB = curriculums[ b ];

        if (!dataA || !dataB) return 0;

        if (dataA.isDraft === dataB.isDraft)
        {
            // Assuming Dayjs objects. If they are raw dates, use dataB.updatedAt.getTime() - dataA.updatedAt.getTime()
            return dataB.updatedAt.diff(dataA.updatedAt);
        }
        return dataA.isDraft ? 1 : -1;
    });
}

export async function fetchDrawerData({ isMounted, enqueueSnackbar, setCurriculumsData, setIsFetchingDetails, }: {
    isMounted: boolean,
    enqueueSnackbar: EnqueueSnackbar,
    setCurriculumsData: React.Dispatch<React.SetStateAction<Record<GanttCurriculumId, GanttCurriculumDocument>>>;
    setIsFetchingDetails: React.Dispatch<React.SetStateAction<boolean>>;
}): Promise<void>
{
    try
    {
        const listData = await ganttApi.curriculum.apiList();
        const keys: Array<GanttCurriculumId> = Object.keys(listData);

        if (keys.length === 0)
        {
            if (isMounted)
            {
                setCurriculumsData(({} as Record<GanttCurriculumId, GanttCurriculumDocument>));
                setIsFetchingDetails(false);
            }
            return;
        }

        const detailedData = await ganttApi.curriculum.apiGetMany(keys);

        if (isMounted)
        {
            setCurriculumsData((detailedData as Record<GanttCurriculumId, GanttCurriculumDocument>));
        }
    } catch (error)
    {
        enqueueApiErrorSnackbar(enqueueSnackbar, `טעינת הגאנט נכשלה!`, error);
    } finally
    {
        if (isMounted)
        {
            setIsFetchingDetails(false);
        }
    }
};  
