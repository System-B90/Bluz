import { EnqueueSnackbar } from "notistack";

import { ganttApi } from "@/api-client/gantt";
import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";

export {
    byUpdatedAtDesc,
    flattenCurriculumGroups,
    groupCurriculumsByStatus,
    type CurriculumGroups,
} from "@/components/gantt/state/curriculum-list";

export async function fetchDrawerData({
    isMounted,
    enqueueSnackbar,
    setCurriculumsData,
    setIsFetchingDetails,
}: {
    isMounted: boolean;
    enqueueSnackbar: EnqueueSnackbar;
    setCurriculumsData: React.Dispatch<
        React.SetStateAction<Record<GanttCurriculumId, GanttCurriculumDocument>>
    >;
    setIsFetchingDetails: React.Dispatch<React.SetStateAction<boolean>>;
}): Promise<void> {
    try {
        const listData = await ganttApi.curriculum.apiList();
        const keys: Array<GanttCurriculumId> = Object.keys(listData);

        if (keys.length === 0) {
            if (isMounted) {
                setCurriculumsData(
                    {} as Record<GanttCurriculumId, GanttCurriculumDocument>,
                );
                setIsFetchingDetails(false);
            }
            return;
        }

        const detailedData = await ganttApi.curriculum.apiGetMany(keys);

        if (isMounted) {
            setCurriculumsData(
                detailedData as Record<
                    GanttCurriculumId,
                    GanttCurriculumDocument
                >,
            );
        }
    } catch (error) {
        enqueueApiErrorSnackbar(enqueueSnackbar, `טעינת הגאנט נכשלה!`, error);
    } finally {
        if (isMounted) {
            setIsFetchingDetails(false);
        }
    }
}
