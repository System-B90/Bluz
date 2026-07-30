import Box, { BoxProps } from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import { useSnackbar } from "notistack";
import React, { useCallback } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { ImportExportMenuButton } from "@/components/base/ImportExportMenuButton";
import { CreateSyllabusButton } from "@/components/gantt/curriculum-view/components/syllabuses-actions-box/CreateSyllabusButton";
import { SyllabusSelectionField } from "@/components/gantt/curriculum-view/components/syllabuses-actions-box/SyllabusSelectionField";
import { GanttSearchField } from "@/components/gantt/curriculum-view/search/GanttSearchField";
import { useModuleActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleActions";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";
import { useCurriculumState } from "@/components/gantt/state/provider";

export type SyllabusesActionsBoxProps = {
    curriculumId: GanttCurriculumId;
    onToggleAllExpanded?: () => void;
    visibleSyllabusCount?: number;
    expandedCount?: number;
} & Omit<BoxProps, "display" | "justifyContent">;

export function SyllabusesActionsBox({
    curriculumId,
    onToggleAllExpanded,
    visibleSyllabusCount = 0,
    expandedCount = 0,
    ...boxProps
}: SyllabusesActionsBoxProps)
{
    const { enqueueSnackbar } = useSnackbar();
    const state = useCurriculumState();
    const curriculum = state.curriculums[ curriculumId ];

    const { createSyllabus } = useSyllabusActions();
    const { createModule } = useModuleActions();
    const { createEvent } = useModuleEventActions();

    const handleExport = useCallback(() =>
    {
        if (!curriculum) return;
        try
        {
            const syllabusesData = curriculum.syllabuses
                .map((syllabusId) =>
                {
                    const syllabus = state.syllabuses[ syllabusId ];
                    if (!syllabus) return null;
                    const modules = (syllabus.modules ?? [])
                        .map((moduleId) =>
                        {
                            const moduleDoc = state.modules[ moduleId ];
                            if (!moduleDoc) return null;
                            const events = (moduleDoc.events ?? [])
                                .map((eventId) =>
                                {
                                    const eventDoc = state.events[ eventId ];
                                    if (!eventDoc) return null;
                                    return {
                                        title: eventDoc.title,
                                        type: eventDoc.type,
                                        minimumDuration:
                                            eventDoc.minimumDuration,
                                        allocatedDuration:
                                            eventDoc.allocatedDuration,
                                        constraints: eventDoc.constraints,
                                        hiveSubjectId: eventDoc.hiveSubjectId,
                                        hiveModuleId: eventDoc.hiveModuleId,
                                        hiveLessonId: eventDoc.hiveLessonId,
                                    };
                                })
                                .filter(Boolean);
                            return {
                                title: moduleDoc.title,
                                description: moduleDoc.description,
                                hiveIds: moduleDoc.hiveIds,
                                events,
                            };
                        })
                        .filter(Boolean);
                    return {
                        title: syllabus.title,
                        hiveIds: syllabus.hiveIds,
                        modules,
                    };
                })
                .filter(Boolean);

            const dataStr =
                "data:text/json;charset=utf-8," +
                encodeURIComponent(JSON.stringify(syllabusesData, null, 2));
            const downloadAnchor = document.createElement("a");
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute(
                "download",
                `bluz-syllabuses-${curriculumId}.json`,
            );
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            enqueueSnackbar("הסילבוסים יוצאו בהצלחה!", { variant: "success" });
        } catch
        {
            enqueueSnackbar("ייצוא הסילבוסים נכשל!", { variant: "error" });
        }
    }, [ curriculum, state, curriculumId, enqueueSnackbar ]);

    const handleImport = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) =>
        {
            const file = e.target.files?.[ 0 ];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) =>
            {
                try
                {
                    const importedSyllabuses = JSON.parse(
                        event.target?.result as string,
                    );
                    if (!Array.isArray(importedSyllabuses))
                    {
                        throw new Error(
                            "Invalid format: expected an array of syllabuses",
                        );
                    }

                    enqueueSnackbar("מתחיל ייבוא סילבוסים...", {
                        variant: "info",
                    });

                    for (const syllabusData of importedSyllabuses)
                    {
                        const newSyllabus = await createSyllabus(
                            syllabusData.title || "סילבוס מיובא",
                            curriculumId,
                            syllabusData.hiveIds || [],
                        );

                        if (Array.isArray(syllabusData.modules))
                        {
                            for (const moduleData of syllabusData.modules)
                            {
                                const newModule = await createModule(
                                    moduleData.title || "מערך מיובא",
                                    newSyllabus.id,
                                    moduleData.description || "",
                                    moduleData.hiveIds || [],
                                );

                                if (Array.isArray(moduleData.events))
                                {
                                    for (const eventData of moduleData.events)
                                    {
                                        await createEvent(
                                            eventData.title || "מופע מיובא",
                                            newModule.id,
                                            eventData.type,
                                            eventData.minimumDuration || 0,
                                            eventData.allocatedDuration || 0,
                                            eventData.hiveSubjectId ?? null,
                                            eventData.hiveModuleId ?? null,
                                            eventData.hiveLessonId ?? null,
                                        );
                                    }
                                }
                            }
                        }
                    }

                    enqueueSnackbar("ייבוא הסילבוסים הושלם בהצלחה!", {
                        variant: "success",
                    });
                } catch (error: any)
                {
                    enqueueApiErrorSnackbar(
                        enqueueSnackbar,
                        "ייבוא הסילבוסים נכשל!",
                        error,
                    );
                } finally
                {
                    e.target.value = "";
                }
            };
            reader.readAsText(file);
        },
        [
            curriculumId,
            createSyllabus,
            createModule,
            createEvent,
            enqueueSnackbar,
        ],
    );

    return (
        <Box
            alignItems="center"
            display="flex"
            gap={ 1.5 }
            justifyContent="flex-start"
            { ...boxProps }
            width="100%"
        >
            <Box alignItems="center" display="flex" flexShrink={ 0 } gap={ 1.5 }>
                <CreateSyllabusButton curriculumId={ curriculumId } />
                <SyllabusSelectionField
                    alignItems="center"
                    curriculumId={ curriculumId }
                    display="flex"
                    flexDirection="row"
                    gap={ 1 }
                    width={ 260 }
                />
            </Box>

            <Divider flexItem orientation="vertical" />

            <GanttSearchField />

            <Box flexGrow={ 1 } />

            { visibleSyllabusCount > 0 && (
                <Button
                    onClick={ onToggleAllExpanded }
                    size="small"
                    variant="outlined"
                >
                    { expandedCount === visibleSyllabusCount
                        ? "לצמצם הכל"
                        : "להרחיב הכל" }
                </Button>
            ) }
            <ImportExportMenuButton
                color="primary"
                exportLabel="ייצוא סילבוסים"
                importLabel="ייבוא סילבוסים"
                onExport={ handleExport }
                onImport={ handleImport }
                size="small"
                triggerLabel="ייבוא / ייצוא סילבוסים"
                variant="outlined"
            />
        </Box>
    );
}
