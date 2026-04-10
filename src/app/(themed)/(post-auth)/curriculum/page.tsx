'use client';
import { CurriculumId } from "@/api-shared/types/curriculum";
import CurriculumView from "@/components/gant/curriculum-view";
import CurriculumDrawer from "@/components/gant/drawer";
import { CurriculumProvider } from "@/components/gant/providers/curriculum-provider";
import { Box } from "@mui/material";
import { useState } from "react";

export default function CurriculumPage()
{
    const [ drawerOpen, setDrawerOpen ] = useState(true);
    const [ currentCurriculum, setCurrentCurriculum ] = useState<CurriculumId | null>(null);

    return (
        <Box maxHeight={ '100%' } height={ '100%' } display={ 'flex' } flexDirection={ 'row' }>
            <CurriculumDrawer sx={ {
                height: '100%',
                '& .MuiDrawer-paper': {
                    boxSizing: 'border-box',
                    position: 'relative',
                },
            } } open={ drawerOpen } setOpen={ setDrawerOpen } setCurrentCurriculum={ setCurrentCurriculum } />
            <Box sx={ { padding: 2 } } flexGrow={ 1 }>
                { currentCurriculum && <CurriculumProvider itemId={ currentCurriculum }>
                    <CurriculumView curriculumId={ currentCurriculum } />
                </CurriculumProvider> }
            </Box>
        </Box >
    );
}
