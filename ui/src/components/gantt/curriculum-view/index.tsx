"use client";
import Box, { BoxProps } from "@mui/material/Box";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { CurriculumViewSidebar } from "@/components/gantt/curriculum-view/components/sidebars";
import { GanttSearchNavProvider } from "@/components/gantt/curriculum-view/search/GanttSearchNavProvider";
import { CurriculumViewTabs } from "@/components/gantt/curriculum-view/tabs";

export type CurriculumViewProps = {
    curriculumId: GanttCurriculumId | null;
} & BoxProps;

export function CurriculumView({
    curriculumId,
    ...props
}: CurriculumViewProps) {
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [selectedTabIndex, setSelectedTabIndex] = useState<number>(() => {
        const viewIndexFromUrl = searchParams.get("v");
        const parsedViewIndex = viewIndexFromUrl
            ? parseInt(viewIndexFromUrl, 10)
            : 0;

        return Number.isFinite(parsedViewIndex) ? parsedViewIndex : 0;
    });

    useEffect(() => {
        if (typeof window === "undefined") {
            return;
        }

        const currentViewIndex = selectedTabIndex.toString();
        const nextParams = new URLSearchParams(window.location.search);

        if (nextParams.get("v") === currentViewIndex) {
            return;
        }

        nextParams.set("v", currentViewIndex);

        const hash = window.location.hash;
        const nextSearch = nextParams.toString();
        const nextUrl = `${pathname}${nextSearch ? `?${nextSearch}` : ""}${hash}`;

        window.history.replaceState(window.history.state, "", nextUrl);
    }, [selectedTabIndex, pathname]);

    return (
        <GanttSearchNavProvider>
            <Box
                alignItems={"flex-start"}
                display={"flex"}
                flexDirection={"row"}
                flexWrap={"nowrap"}
                gap={4}
                height={"100%"}
                justifyContent={"flex-start"}
                justifyItems={"flex-start"}
                width={"100%"}
                {...props}
            >
                <CurriculumViewSidebar
                    curriculumId={curriculumId}
                    selectedTabIndex={selectedTabIndex}
                />

                <CurriculumViewTabs
                    curriculumId={curriculumId}
                    display={"flex"}
                    flexDirection={"column"}
                    flexGrow={1}
                    height={"100%"}
                    selectedTabIndex={selectedTabIndex}
                    setSelectedTabIndex={setSelectedTabIndex}
                    width={"100%"}
                />
            </Box>
        </GanttSearchNavProvider>
    );
}
