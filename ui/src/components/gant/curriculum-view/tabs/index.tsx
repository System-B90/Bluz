import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import SyllabusesTab from "@/components/gant/curriculum-view/tabs/syllabuses-tab";
import WeeksTab from "@/components/gant/curriculum-view/tabs/weeks-tab";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import { Box, BoxProps, Tab, Tabs } from "@mui/material";
import { Dispatch, SetStateAction, useState } from "react";

export interface CurriculumViewTabsProps extends BoxProps
{
    curriculumId: CurriculumId | null;
}

function TabLabels({ selectedTabIndex, setSelectedTabIndex }: { selectedTabIndex: number; setSelectedTabIndex: Dispatch<SetStateAction<number>>; })
{
    return (
        <Tabs
            value={ selectedTabIndex }
            onChange={ (_, v) => setSelectedTabIndex(v) }
            variant='scrollable'
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
        >
            <Tab label='סילבוסים' />
            <Tab label='שבועות' />
        </Tabs>
    );
}

export default function CurriculumViewTabs({ curriculumId, ...props }: CurriculumViewTabsProps)
{
    const [ selectedTabIndex, setSelectedTabIndex ] = useState<number>(0);

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
                </Box>
            }
        </Box>
    );
}
