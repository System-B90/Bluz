import { CurriculumId } from "@/api-shared/types/gantt/curriculum";
import { AboutTimeCurriculumViewSidebar } from "@/components/gantt/curriculum-view/components/sidebars/about-time";

export function CurriculumViewSidebar({ selectedTabIndex, curriculumId }: { selectedTabIndex: number; curriculumId: CurriculumId | null; })
{
    return (
        (selectedTabIndex >= 0 && selectedTabIndex <= 1) && <AboutTimeCurriculumViewSidebar curriculumId={ curriculumId } /> || <></>
    );
}
