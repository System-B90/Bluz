import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import SyllabusesTab from "@/components/gant/curriculum-view/tabs/syllabuses-tab";
import KeyboardArrowLeft from "@mui/icons-material/KeyboardArrowLeft";
import KeyboardArrowRight from "@mui/icons-material/KeyboardArrowRight";
import { Box, BoxProps, Tab, Tabs } from "@mui/material";
import { useState } from "react";

export interface CurriculumViewTabsProps extends BoxProps
{
    curriculumId: CurriculumId | null;
}

export default function CurriculumViewTabs({ curriculumId, ...props }: CurriculumViewTabsProps)
{
    const [ selectedTabIndex, setSelectedTabIndex ] = useState<number>(0);
    return (
        <Box  { ...props }>
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
            </Tabs>
            <Box flexGrow={ 1 } height={ '80%' }>
                { curriculumId !== null && selectedTabIndex === 0 && (<SyllabusesTab curriculumId={ curriculumId ?? '' } />) }
            </Box>
        </Box>
    );
}
