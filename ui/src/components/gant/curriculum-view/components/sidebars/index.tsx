import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import AboutTimeCurriculumViewSidebar from "@/components/gant/curriculum-view/components/sidebars/about-time";

export default function CurriculumViewSidebar({ selectedTabIndex, curriculumId }: { selectedTabIndex: number; curriculumId: CurriculumId | null; })
{
    return (
        (selectedTabIndex >= 0 && selectedTabIndex <= 1) && <AboutTimeCurriculumViewSidebar curriculumId={ curriculumId } /> || <></>
    );
}