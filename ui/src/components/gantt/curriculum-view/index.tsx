"use client";
import Box, { BoxProps } from "@mui/material/Box";
import { Dispatch, SetStateAction } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { GanttContentCommands } from "@/components/app-commands/GanttContentCommands";
import { useGanttTabCommands } from "@/components/app-commands/use-gantt-tab-commands";
import { GanttOnboarding } from "@/components/app-onboarding/gantt/GanttOnboarding";
import { GanttCreationDeletionCallbackProps } from "@/components/gantt/curriculum-fab/CurriculumActionItems";
import { CurriculumViewSidebar } from "@/components/gantt/curriculum-view/components/sidebars";
import { GanttSearchNavProvider } from "@/components/gantt/curriculum-view/search/GanttSearchNavProvider";
import { CurriculumViewTabs } from "@/components/gantt/curriculum-view/tabs";
import { useGanttTabUrl } from "@/components/gantt/curriculum-view/use-gantt-tab-url";
import { GanttFiltersProvider } from "@/components/gantt/state/filters/Provider";
import { useCurriculumStatusSync } from "@/components/gantt/state/hooks/UseCurriculumStatusSync";

export type CurriculumViewProps = {
    curriculumId: GanttCurriculumId | null;
    setCurrentCurriculum: Dispatch<SetStateAction<GanttCurriculumId | null>>;
} & BoxProps & GanttCreationDeletionCallbackProps;

export function CurriculumView({
    curriculumId,
    setCurrentCurriculum,
    onCreate, onDelete,
    ...props
}: CurriculumViewProps)
{
    const [ selectedTabIndex, setSelectedTabIndex ] = useGanttTabUrl();

    useCurriculumStatusSync(curriculumId);
    useGanttTabCommands({ selectedTabIndex, setSelectedTabIndex });

    return (
        <GanttSearchNavProvider>
            <GanttFiltersProvider>
                {/* Needs both the curriculum state and the search-nav context. */ }
                <GanttContentCommands />

                {/* The tour drives the tabs, so it is registered by their owner. */ }
                <GanttOnboarding setSelectedTabIndex={ setSelectedTabIndex } />

                <Box
                    alignItems={ "flex-start" }
                    display={ "flex" }
                    flexDirection={ "row" }
                    flexWrap={ "nowrap" }
                    gap={ 4 }
                    height={ "100%" }
                    justifyContent={ "flex-start" }
                    justifyItems={ "flex-start" }
                    width={ "100%" }
                    { ...props }
                >
                    <CurriculumViewSidebar
                        curriculumId={ curriculumId }
                        onCreate={ onCreate }
                        onDelete={ onDelete }
                        selectedTabIndex={ selectedTabIndex }
                        setCurrentCurriculum={ setCurrentCurriculum }
                    />

                    <CurriculumViewTabs
                        curriculumId={ curriculumId }
                        display={ "flex" }
                        flexDirection={ "column" }
                        flexGrow={ 1 }
                        height={ "100%" }
                        selectedTabIndex={ selectedTabIndex }
                        setSelectedTabIndex={ setSelectedTabIndex }
                        width={ "100%" }
                    />
                </Box>
            </GanttFiltersProvider>
        </GanttSearchNavProvider>
    );
}
