"use client";
import Box, { BoxProps } from "@mui/material/Box";
import { usePathname, useSearchParams } from "next/navigation";
import { Dispatch, SetStateAction, useEffect, useState } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { GanttContentCommands } from "@/components/app-commands/GanttContentCommands";
import { GanttOnboarding } from "@/components/app-onboarding/gantt/GanttOnboarding";
import { GanttCreationDeletionCallbackProps } from "@/components/gantt/curriculum-fab/CurriculumActionItems";
import { CurriculumViewSidebar } from "@/components/gantt/curriculum-view/components/sidebars";
import { GanttSearchNavProvider } from "@/components/gantt/curriculum-view/search/GanttSearchNavProvider";
import { CurriculumViewTabs } from "@/components/gantt/curriculum-view/tabs";
import { GanttFiltersProvider } from "@/components/gantt/state/filters/Provider";

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
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [ selectedTabIndex, setSelectedTabIndex ] = useState<number>(() =>
    {
        const viewIndexFromUrl = searchParams.get("v");
        const parsedViewIndex = viewIndexFromUrl
            ? parseInt(viewIndexFromUrl, 10)
            : 0;

        return Number.isFinite(parsedViewIndex) ? parsedViewIndex : 0;
    });

    useEffect(() =>
    {
        if (typeof window === "undefined")
        {
            return;
        }

        const currentViewIndex = selectedTabIndex.toString();
        const nextParams = new URLSearchParams(window.location.search);

        if (nextParams.get("v") === currentViewIndex)
        {
            return;
        }

        nextParams.set("v", currentViewIndex);

        const hash = window.location.hash;
        const nextSearch = nextParams.toString();
        const nextUrl = `${pathname}${nextSearch ? `?${nextSearch}` : ""}${hash}`;

        window.history.replaceState(window.history.state, "", nextUrl);
    }, [ selectedTabIndex, pathname ]);

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
