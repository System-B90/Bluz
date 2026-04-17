import { EnqueueSnackbar } from "notistack";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { curriculumApi, CurriculumDocument } from "@/api-client/gant/curriculum";
import { CurriculumId } from "@/api-shared/types/gant/curriculum";

export function sortCurriculumsByDraftAndUpdatedAt(curriculums: Record<CurriculumId, CurriculumDocument>): Array<CurriculumId>
{
    return (Object.keys(curriculums) as CurriculumId[]).sort((a, b) =>
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
    setCurriculumsData: React.Dispatch<React.SetStateAction<Record<CurriculumId, CurriculumDocument>>>;
    setIsFetchingDetails: React.Dispatch<React.SetStateAction<boolean>>;
}): Promise<void>
{
    try
    {
        const listData = await curriculumApi.apiList();
        const keys: Array<CurriculumId> = Object.keys(listData);

        if (keys.length === 0)
        {
            if (isMounted)
            {
                setCurriculumsData(({} as Record<CurriculumId, CurriculumDocument>));
                setIsFetchingDetails(false);
            }
            return;
        }

        const detailedData = await curriculumApi.apiGetMany(keys);

        if (isMounted)
        {
            setCurriculumsData((detailedData as Record<CurriculumId, CurriculumDocument>));
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
