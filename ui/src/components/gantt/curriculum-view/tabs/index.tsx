import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import { Box, BoxProps, Tab, Tabs } from "@mui/material";
import { Dispatch, Fragment, SetStateAction } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/curriculum";
import { CurriculumViewBuilderTab } from "@/components/gantt/curriculum-view/tabs/builder-tab";
import { CurriculumGanttView } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab";
import { SyllabusesTab } from "@/components/gantt/curriculum-view/tabs/syllabuses-tab";
import { WeeksTab } from "@/components/gantt/curriculum-view/tabs/weeks-tab";

interface TabProps
{
    selectedTabIndex: number;
    setSelectedTabIndex: Dispatch<SetStateAction<number>>;
}

export interface CurriculumViewTabsProps extends BoxProps, TabProps
{
    curriculumId: GanttCurriculumId | null;
}

function TabLabels({ selectedTabIndex, setSelectedTabIndex }: TabProps)
{
    return (
        <Fragment>
            <Box width={ (selectedTabIndex === 2) ? '14rem' : 0 } />
            <Tabs
                onChange={ (_, v) => setSelectedTabIndex(v) }
                slots={ {
                    StartScrollButtonIcon: KeyboardArrowLeft,
                    EndScrollButtonIcon: KeyboardArrowRight,
                } }
                sx={ {
                    mb: 1.5,
                    flexDirection: "row-reverse", // TODO: Known issue: https://github.com/mui/material-ui/issues/30409?issue=mui%7Cmaterial-ui%7C30207
                    '& .MuiTabs-scroller': {
                        // Ensures the scroll container respects the RTL flow
                        direction: 'ltr',
                    },
                    '& .MuiTabs-flexContainer': {
                        flexDirection: "row",
                    }
                } }
                value={ selectedTabIndex }
                variant='scrollable'
            >
                <Tab label='סילבוסים' />
                <Tab label='שבועות' />
                <Tab label='בנייה' />
                <Tab label='רצף זמן' />
            </Tabs>
        </Fragment>
    );
}

export function CurriculumViewTabs({ curriculumId, selectedTabIndex, setSelectedTabIndex, ...props }: CurriculumViewTabsProps)
{
    return (
        <Box { ...props }>
            <TabLabels
                selectedTabIndex={ selectedTabIndex }
                setSelectedTabIndex={ setSelectedTabIndex }
            />
            {
                curriculumId !== null &&
                <Box flexGrow={ 1 } height="80%">
                    { selectedTabIndex === 0 && <SyllabusesTab curriculumId={ curriculumId } /> }
                    { selectedTabIndex === 1 && <WeeksTab curriculumId={ curriculumId } /> }
                    { selectedTabIndex === 2 && <CurriculumViewBuilderTab curriculumId={ curriculumId } /> }
                    { selectedTabIndex === 3 && <CurriculumGanttView curriculumId={ curriculumId } /> }
                </Box>
            }
        </Box>
    );
}
