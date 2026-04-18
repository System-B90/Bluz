import { Divider } from "@mui/material";
import {
  Dispatch,
  SetStateAction,
  useCallback,
  useMemo,
  useState,
} from "react";
import { Fragment } from "react/jsx-runtime";

import {
  GanttCurriculumId,
  GanttWeekId,
} from "@/api-shared/types/gantt/models/curriculum";
import { SyllabusModulesCurriculumViewSidebar } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/syllabus-modules";
import { partitionWeeks } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/utils";
import { WeekGroupPanel } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/WeekGroupPanel";
import { useCurriculumState } from "@/components/gantt/state/provider";

export function CurriculumViewBuilderWeeksView({
  curriculumId,
  weeks,
  groupCount,
  setSelectedWeekGroup,
}: {
  curriculumId: GanttCurriculumId;
  groupCount: number;
  weeks: Array<GanttWeekId>;
  setSelectedWeekGroup: Dispatch<
    SetStateAction<{ start: number; length: number }>
  >;
}) {
  const { weeks: weeksState } = useCurriculumState();
  const [animationSelectedGroupIndex, setAnimationSelectedGroupIndex] =
    useState<null | number>(null);
  const groupedWeeks = useMemo(
    () => partitionWeeks(weeks, groupCount),
    [weeks, groupCount],
  );
  const onGroupClick = useCallback(
    (groupIndex: number, start: number, length: number) => {
      console.log(start, length);
      setAnimationSelectedGroupIndex(groupIndex);
      setTimeout(() => {
        setSelectedWeekGroup({ start, length });
        setAnimationSelectedGroupIndex(null);
      }, 400);
    },
    [setSelectedWeekGroup],
  );

  const weekGroupPanels = useMemo(
    () =>
      groupedWeeks.map((group, index) => {
        const isLast = index === groupedWeeks.length - 1;
        const firstWeekNum = weeksState[group[0]]?.number ?? 1;
        const lastWeekNum =
          weeksState[group[group.length - 1]]?.number ?? group.length;
        const groupKey = `group-${firstWeekNum}-${lastWeekNum}`;

        return (
          <Fragment key={`frag-${groupKey}`}>
            <WeekGroupPanel
              flexBasis={0}
              flexGrow={
                animationSelectedGroupIndex === null
                  ? 1
                  : animationSelectedGroupIndex === index
                    ? 1
                    : 0
              }
              flexShrink={
                animationSelectedGroupIndex === null
                  ? undefined
                  : animationSelectedGroupIndex === index
                    ? 0
                    : 1
              }
              group={group}
              key={groupKey}
              onExpandGroup={() =>
                onGroupClick(index, firstWeekNum - 1, group.length)
              }
            />
            {!isLast && (
              <Divider
                className="h-4/5 self-center"
                orientation="vertical"
                variant="middle"
              />
            )}
          </Fragment>
        );
      }),
    [animationSelectedGroupIndex, groupedWeeks, onGroupClick, weeksState],
  );

  return (
    <Fragment>
      <SyllabusModulesCurriculumViewSidebar curriculumId={curriculumId} />
      {weekGroupPanels}
    </Fragment>
  );
}
