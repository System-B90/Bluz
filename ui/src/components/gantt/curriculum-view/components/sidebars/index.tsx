import { GanttCurriculumId } from "@/api-shared/types/gantt/models/curriculum";
import { AboutTimeCurriculumViewSidebar } from "@/components/gantt/curriculum-view/components/sidebars/about-time";

export function CurriculumViewSidebar({
  selectedTabIndex,
  curriculumId,
}: {
  selectedTabIndex: number;
  curriculumId: GanttCurriculumId | null;
}) {
  return (
    (selectedTabIndex >= 0 && selectedTabIndex <= 1 && (
      <AboutTimeCurriculumViewSidebar curriculumId={curriculumId} />
    )) || <></>
  );
}
