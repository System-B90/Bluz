import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import Box, { BoxProps } from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import
    {
        Dispatch,
        Fragment,
        SetStateAction,
        memo,
        startTransition,
        useEffect,
        useState,
    } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { CurriculumViewBuilderTab } from "@/components/gantt/curriculum-view/tabs/builder-tab";
import { CurriculumGanttView } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab";
import { SyllabusesTab } from "@/components/gantt/curriculum-view/tabs/syllabuses-tab";
import { WeeksTab } from "@/components/gantt/curriculum-view/tabs/weeks-tab";

type TabProps = {
    selectedTabIndex: number;
    setSelectedTabIndex: Dispatch<SetStateAction<number>>;
};

const MemoizedCurriculumGanttView = memo(CurriculumGanttView);
const MemoizedCurriculumViewBuilderTab = memo(CurriculumViewBuilderTab);

export type CurriculumViewTabsProps = {
    curriculumId: GanttCurriculumId | null;
} & BoxProps &
    TabProps;

function TabLabels({ selectedTabIndex, setSelectedTabIndex }: TabProps) {
    return (
        <Fragment>
            <Box width={selectedTabIndex === 2 ? "14rem" : 0} />
            <Tabs
                onChange={(_, v) => setSelectedTabIndex(v)}
                slots={{
                    StartScrollButtonIcon: KeyboardArrowLeft,
                    EndScrollButtonIcon: KeyboardArrowRight,
                }}
                sx={{
                    mb: 1.5,
                    flexDirection: "row-reverse", // TODO: Known issue: https://github.com/mui/material-ui/issues/30409?issue=mui%7Cmaterial-ui%7C30207
                    "& .MuiTabs-scroller": {
                        // Ensures the scroll container respects the RTL flow
                        direction: "ltr",
                    },
                    "& .MuiTabs-flexContainer": {
                        flexDirection: "row",
                    },
                }}
                value={selectedTabIndex}
                variant="scrollable"
            >
                <Tab label="סילבוסים" />
                <Tab label="שבועות" />
                <Tab label="בנייה" />
                <Tab label="רצף זמן" />
            </Tabs>
        </Fragment>
    );
}

function scheduleTabContentMount(callback: () => void) {
    if (typeof window === "undefined") {
        return () => {};
    }

    let frameId = window.requestAnimationFrame(() => {
        frameId = window.requestAnimationFrame(callback);
    });

    return () => window.cancelAnimationFrame(frameId);
}

function TabContentFallback() {
    return (
        <Box
            alignItems="center"
            display="flex"
            height="100%"
            justifyContent="center"
            width="100%"
        >
            <CircularProgress size={28} />
        </Box>
    );
}

function renderTabContent(tabIndex: number, curriculumId: GanttCurriculumId) {
    switch (tabIndex) {
    case 0:
        return <SyllabusesTab curriculumId={curriculumId} />;
    case 1:
        return <WeeksTab curriculumId={curriculumId} />;
    case 2:
        return (
            <MemoizedCurriculumViewBuilderTab curriculumId={curriculumId} />
        );
    case 3:
        return <MemoizedCurriculumGanttView curriculumId={curriculumId} />;
    default:
        return null;
    }
}

function DeferredTabContent({
    curriculumId,
    selectedTabIndex,
}: {
    curriculumId: GanttCurriculumId;
    selectedTabIndex: number;
}) {
    const [renderedTabIndex, setRenderedTabIndex] = useState(selectedTabIndex);
    const isPendingTabContent = renderedTabIndex !== selectedTabIndex;

    useEffect(() => {
        if (!isPendingTabContent) {
            return;
        }

        return scheduleTabContentMount(() => {
            startTransition(() => {
                setRenderedTabIndex(selectedTabIndex);
            });
        });
    }, [isPendingTabContent, selectedTabIndex]);

    if (isPendingTabContent) {
        return <TabContentFallback />;
    }

    return renderTabContent(renderedTabIndex, curriculumId);
}

export function CurriculumViewTabs({
    curriculumId,
    selectedTabIndex,
    setSelectedTabIndex,
    ...props
}: CurriculumViewTabsProps) {
    return (
        <Box {...props}>
            <TabLabels
                selectedTabIndex={selectedTabIndex}
                setSelectedTabIndex={setSelectedTabIndex}
            />
            {curriculumId !== null && (
                <Box flexGrow={1} height="80%">
                    <DeferredTabContent
                        curriculumId={curriculumId}
                        selectedTabIndex={selectedTabIndex}
                    />
                </Box>
            )}
        </Box>
    );
}
