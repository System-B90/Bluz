import { Box } from "@mui/material";

import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { CurriculumAboutCard } from "@/components/gant/curriculum-view/components/curriculum-about-card";
import { HoursCard } from "@/components/gant/curriculum-view/components/HoursCard";
import { WorkTimePanel } from "@/components/gant/curriculum-view/components/WorkTimePanel";
import { useCurriculum } from "@/components/gant/state/hooks/UseCurriculum";

export function AboutTimeCurriculumViewSidebar({ curriculumId }: { curriculumId: CurriculumId | null; })
{
    const curriculum = useCurriculum(curriculumId ?? '');

    return (
        <Box
            display={ 'flex' }
            flexDirection={ 'column' }
            flexGrow={ 1 }
            flexShrink={ 0 }
            flexWrap={ 'nowrap' }
            gap={ 2 }
            height={ '100%' }
            overflow={ 'hidden' }
            pb={ 1 }
            px={ 1 }
        >
            <CurriculumAboutCard curriculum={ curriculum } curriculumId={ curriculumId } />
            <HoursCard curriculum={ curriculum } />
            <WorkTimePanel curriculum={ curriculum } curriculumId={ curriculumId } />
        </Box>
    );
}
