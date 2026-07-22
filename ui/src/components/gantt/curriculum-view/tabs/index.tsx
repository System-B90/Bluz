import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import Box, { BoxProps } from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import {
    Dispatch,
    Fragment,
    SetStateAction,
    memo,
    startTransition,
    useEffect,
    useState,
} from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { CutPreviewTab } from "@/components/gantt/curriculum-view/tabs/cut-preview-tab";
import { CurriculumGanttView } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab";
import { SyllabusesTab } from "@/components/gantt/curriculum-view/tabs/syllabuses-tab";
import { TimeframeEventsTab } from "@/components/gantt/curriculum-view/tabs/timeframe-events-tab";
import { WeeksTab } from "@/components/gantt/curriculum-view/tabs/weeks-tab";

type TabProps = {
    selectedTabIndex: number;
    setSelectedTabIndex: Dispatch<SetStateAction<number>>;
};

const MemoizedCurriculumGanttView = memo(CurriculumGanttView);

export type CurriculumViewTabsProps = {
    curriculumId: GanttCurriculumId | null;
} & BoxProps &
    TabProps;

function TabLabels({ selectedTabIndex, setSelectedTabIndex }: TabProps) {
    return (
        <Fragment>
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
                <Tab label="רצף זמן" />
                <Tab label="תצוגה מקדימה" />
                <Tab label="אירועים בטווח" />
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
        return <MemoizedCurriculumGanttView curriculumId={curriculumId} />;
    case 3:
        return <CutPreviewTab curriculumId={curriculumId} />;
    case 4:
        return <TimeframeEventsTab curriculumId={curriculumId} />;
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
    // Defer the *first* mount of each tab by a couple of frames so the tab
    // switch animates smoothly (the old progressive-mount feel), then keep
    // every visited tab mounted and toggle visibility with CSS — so each tab's
    // internal state (expand/collapse, daily/weekly toggle, scroll, filters)
    // survives switching away and back (#326).
    const [visitedTabIndices, setVisitedTabIndices] = useState<Set<number>>(
        () => new Set(),
    );
    const isActiveMounted = visitedTabIndices.has(selectedTabIndex);

    useEffect(() => {
        if (isActiveMounted) {
            return;
        }

        return scheduleTabContentMount(() => {
            startTransition(() => {
                setVisitedTabIndices((prev) => {
                    if (prev.has(selectedTabIndex)) {
                        return prev;
                    }
                    const next = new Set(prev);
                    next.add(selectedTabIndex);
                    return next;
                });
            });
        });
    }, [isActiveMounted, selectedTabIndex]);

    return (
        <Fragment>
            {!isActiveMounted ? <TabContentFallback /> : null}
            {Array.from(visitedTabIndices).map((tabIndex) => (
                <Box
                    key={tabIndex}
                    sx={{
                        display:
                            tabIndex === selectedTabIndex ? "flex" : "none",
                        flexDirection: "column",
                        height: "100%",
                        minHeight: 0,
                    }}
                >
                    {renderTabContent(tabIndex, curriculumId)}
                </Box>
            ))}
        </Fragment>
    );
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
                <Box flexGrow={1} height="100%" minHeight={0}>
                    <DeferredTabContent
                        curriculumId={curriculumId}
                        key={curriculumId}
                        selectedTabIndex={selectedTabIndex}
                    />
                </Box>
            )}
        </Box>
    );
}
