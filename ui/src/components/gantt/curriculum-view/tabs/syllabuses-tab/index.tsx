import { Box, Card, CardContent, Skeleton } from "@mui/material";
import { memo, useMemo } from "react";

import {
    GanttCurriculumId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { SyllabusesActionsBox } from "@/components/gantt/curriculum-view/components/syllabuses-actions-box";
import { useProgressiveItemCount } from "@/components/gantt/curriculum-view/tabs/UseProgressiveItemCount";
import { useCurriculum } from "@/components/gantt/state/hooks/UseCurriculum";
import { SyllabusCard } from "@/components/gantt/syllabus-card";

type SyllabusesTabProps = {
    curriculumId: GanttCurriculumId;
};

const INITIAL_SYLLABUS_CARD_COUNT = 2;
const SYLLABUS_CARD_BATCH_SIZE = 2;
const MAX_SYLLABUS_CARD_SKELETONS = 3;
const EMPTY_SYLLABUS_IDS: Array<GanttSyllabusId> = [];

function SyllabusCardSkeleton()
{
    return (
        <Card
            sx={ {
                display: "flex",
                flexDirection: "column",
                maxHeight: "90%",
                minHeight: 320,
                minWidth: 350,
                width: "30%",
            } }
        >
            <Box alignItems="center" display="flex" gap={ 2 } px={ 2 } py={ 1.5 }>
                <Box flex={ 1 }>
                    <Skeleton height={ 22 } width="70%" />
                    <Skeleton height={ 18 } width="45%" />
                </Box>
                <Skeleton height={ 32 } variant="circular" width={ 32 } />
            </Box>
            <CardContent
                sx={ {
                    display: "flex",
                    flexDirection: "column",
                    gap: 1,
                    pt: 1,
                } }
            >
                <Skeleton height={ 34 } variant="rounded" />
                { Array.from({ length: 5 }).map((_, index) => (
                    <Skeleton height={ 38 } key={ index } variant="rounded" />
                )) }
            </CardContent>
        </Card>
    );
}

export const SyllabusesTab = memo(function SyllabusesTab({
    curriculumId,
}: SyllabusesTabProps)
{
    const curriculum = useCurriculum(curriculumId);
    const syllabuses = curriculum?.syllabuses ?? EMPTY_SYLLABUS_IDS;
    const visibleSyllabusCount = useProgressiveItemCount(syllabuses.length, {
        batchSize: SYLLABUS_CARD_BATCH_SIZE,
        initialCount: INITIAL_SYLLABUS_CARD_COUNT,
        resetKey: curriculumId,
    });
    const hiddenSyllabusCount = syllabuses.length - visibleSyllabusCount;

    const syllabusCards = useMemo(() =>
    {
        return syllabuses.slice(0, visibleSyllabusCount).map((syllabusId) => (
            <SyllabusCard
                curriculumId={ curriculumId }
                key={ syllabusId }
                syllabusId={ syllabusId }
            />
        ));
    }, [ curriculumId, syllabuses, visibleSyllabusCount ]);

    return (
        <Box
            display={ "flex" }
            flexDirection={ "column" }
            flexGrow={ 1 }
            gap={ 2 }
            height={ "100%" }
        >
            <Box
                display="flex"
                flexDirection="column"
                gap={ 1 }
                height={ "100%" }
                width={ "100%" }
            >
                <SyllabusesActionsBox curriculumId={ curriculumId } mb={ 0 } />
                <Box
                    alignContent={ "flex-start" }
                    display={ "flex" }
                    flexDirection={ "column" }
                    flexWrap={ "wrap" }
                    gap={ 2 }
                    height={ "100%" }
                    pt={ 1 }
                    sx={ { overflowX: "scroll" } }
                >
                    { syllabusCards }
                    { Array.from({
                        length: Math.min(
                            hiddenSyllabusCount,
                            MAX_SYLLABUS_CARD_SKELETONS,
                        ),
                    }).map((_, index) => (
                        <SyllabusCardSkeleton key={ `syllabus-card-skeleton-${index}` } />
                    )) }
                </Box>
            </Box>
        </Box>
    );
});
