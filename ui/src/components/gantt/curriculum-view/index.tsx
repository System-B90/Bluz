"use client";
import { Box, BoxProps } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models/curriculum";
import { CurriculumViewSidebar } from "@/components/gantt/curriculum-view/components/sidebars";
import { CurriculumViewTabs } from "@/components/gantt/curriculum-view/tabs";

export interface CurriculumViewProps extends BoxProps {
  curriculumId: GanttCurriculumId | null;
}

export function CurriculumView({
  curriculumId,
  ...props
}: CurriculumViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [selectedTabIndex, setSelectedTabIndex] = useState<number>(() => {
    const viewIndexFromUrl = searchParams.get("v");
    return viewIndexFromUrl ? parseInt(viewIndexFromUrl) : 0;
  });

  useEffect(() => {
    const urlViewIndex = searchParams.get("v");
    const currentViewIndex = selectedTabIndex.toString() ?? null;

    if (urlViewIndex === currentViewIndex) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());
    if (currentViewIndex) {
      nextParams.set("v", currentViewIndex);
    } else {
      nextParams.delete("v");
    }

    const nextSearch = nextParams.toString();
    router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname);
  }, [selectedTabIndex, pathname, router, searchParams]);

  return (
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
  );
}
