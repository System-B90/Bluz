import { Box } from "@mui/material";

import { CurriculumId } from "@/api-shared/types/gant/curriculum";
import { CurriculumAboutCard } from "@/components/gant/curriculum-view/components/curriculum-about-card";
import { HoursCard } from "@/components/gant/curriculum-view/components/HoursCard";
import { WorkTimePanel } from "@/components/gant/curriculum-view/components/WorkTimePanel";
import { useCurriculum } from "@/components/gant/state/hooks";

export default function AboutTimeCurriculumViewSidebar({ curriculumId }: { curriculumId: CurriculumId | null; })
{
    const curriculum = useCurriculum(curriculumId ?? '');

    return (
        <Box
            display={ 'flex' }
            flexGrow={ 1 }
            flexShrink={ 0 }
            flexDirection={ 'column' }
            flexWrap={ 'nowrap' }
            gap={ 2 }
            overflow={ 'hidden' }
            px={ 1 }
            pb={ 1 }
            height={ '100%' }
        >
            <CurriculumAboutCard curriculum={ curriculum } curriculumId={ curriculumId } />
            <HoursCard curriculum={ curriculum } />
            <WorkTimePanel curriculumId={ curriculumId } curriculum={ curriculum } />
        </Box>
    );
}
