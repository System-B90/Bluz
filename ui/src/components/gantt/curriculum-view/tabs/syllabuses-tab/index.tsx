import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Skeleton from "@mui/material/Skeleton";
import { memo, useMemo, useState } from "react";

import
{
    GanttCurriculumId,
    GanttSyllabusId,
} from "@/api-shared/types/gantt/models";
import { EmptyState } from "@/components/base/EmptyState";
import { SyllabusesActionsBox } from "@/components/gantt/curriculum-view/components/syllabuses-actions-box";
import { useProgressiveItemCount } from "@/components/gantt/curriculum-view/tabs/UseProgressiveItemCount";
import { useGanttFilters } from "@/components/gantt/state/filters/Provider";
import { useCurriculum } from "@/components/gantt/state/hooks/UseCurriculum";
import { useCurriculumState } from "@/components/gantt/state/provider";
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
    const state = useCurriculumState();
    const { syllabusMatches, hasActiveFilters, description, clearFilters } =
        useGanttFilters();
    const allSyllabuses = curriculum?.syllabuses ?? EMPTY_SYLLABUS_IDS;
    const syllabuses = useMemo(
        () =>
            hasActiveFilters
                ? allSyllabuses.filter((id) =>
                {
                    const syllabus = state.syllabuses[ id ];
                    return syllabus ? syllabusMatches(syllabus) : false;
                })
                : allSyllabuses,
        [ allSyllabuses, hasActiveFilters, syllabusMatches, state.syllabuses ],
    );
    const visibleSyllabusCount = useProgressiveItemCount(syllabuses.length, {
        batchSize: SYLLABUS_CARD_BATCH_SIZE,
        initialCount: INITIAL_SYLLABUS_CARD_COUNT,
        resetKey: curriculumId,
    });
    const hiddenSyllabusCount = syllabuses.length - visibleSyllabusCount;
    const [ expandedCards, setExpandedCards ] = useState<Set<GanttSyllabusId>>(
        new Set(syllabuses.slice(0, visibleSyllabusCount))
    );

    const syllabusCards = useMemo(() =>
    {
        return syllabuses
            .slice(0, visibleSyllabusCount)
            .map((syllabusId) => (
                <SyllabusCard
                    curriculumId={ curriculumId }
                    expanded={ expandedCards.has(syllabusId) }
                    key={ syllabusId }
                    onExpandChange={ (expanded) =>
                    {
                        setExpandedCards((prev) =>
                        {
                            const next = new Set(prev);
                            if (expanded)
                            {
                                next.add(syllabusId);
                            } else
                            {
                                next.delete(syllabusId);
                            }
                            return next;
                        });
                    } }
                    syllabusId={ syllabusId }
                />
            ));
    }, [ curriculumId, syllabuses, visibleSyllabusCount, expandedCards ]);

    const toggleAllExpanded = () =>
    {
        const allExpanded = expandedCards.size === visibleSyllabusCount;
        if (allExpanded)
        {
            setExpandedCards(new Set());
        } else
        {
            setExpandedCards(new Set(syllabuses.slice(0, visibleSyllabusCount)));
        }
    };

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
                <SyllabusesActionsBox
                    curriculumId={ curriculumId }
                    expandedCount={ expandedCards.size }
                    mb={ 0 }
                    onToggleAllExpanded={ toggleAllExpanded }
                    visibleSyllabusCount={ visibleSyllabusCount }
                />
                <Box
                    alignContent={ "flex-start" }
                    display={ "flex" }
                    flexDirection={ "column" }
                    flexWrap={ "wrap" }
                    gap={ 2 }
                    height={ "100%" }
                    paddingInlineEnd={ 1 }
                    pt={ 1 }
                    sx={ { overflowX: "scroll" } }
                >
                    { allSyllabuses.length === 0 ? (
                        <EmptyState
                            hint="הוספת סילבוס תתחיל את בניית הגאנט."
                            message="לגאנט הזה אין עדיין סילבוסים"
                        />
                    ) : syllabuses.length === 0 ? (
                        <EmptyState
                            actionLabel="ניקוי מסננים"
                            hint={ description }
                            message="אין סילבוסים שתואמים למסננים"
                            onAction={ clearFilters }
                            variant="filtered"
                        />
                    ) : null }
                    { syllabusCards }
                    { Array.from({
                        length: Math.min(
                            hiddenSyllabusCount,
                            MAX_SYLLABUS_CARD_SKELETONS,
                        ),
                    }).map((_, index) => (
                        <SyllabusCardSkeleton
                            key={ `syllabus-card-skeleton-${index}` }
                        />
                    )) }
                </Box>
            </Box>
        </Box>
    );
});
