import DownloadIcon from "@mui/icons-material/Download";
import UploadIcon from "@mui/icons-material/Upload";
import { Box, BoxProps, Button } from "@mui/material";
import { useSnackbar } from "notistack";
import React, { useCallback } from "react";

import { enqueueApiErrorSnackbar } from "@/api-client/common";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { CreateSyllabusButton } from "@/components/gantt/curriculum-view/components/syllabuses-actions-box/CreateSyllabusButton";
import { SyllabusSelectionField } from "@/components/gantt/curriculum-view/components/syllabuses-actions-box/SyllabusSelectionField";
import { useModuleActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleActions";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";
import { useSyllabusActions } from "@/components/gantt/state/hooks/gantt-funcs/UseSyllabusActions";
import { useCurriculumState } from "@/components/gantt/state/provider";

export type SyllabusesActionsBoxProps = {
  curriculumId: GanttCurriculumId;
} & Omit<BoxProps, "display" | "justifyContent">;

export function SyllabusesActionsBox({
    curriculumId,
    ...props
}: SyllabusesActionsBoxProps) {
    const { enqueueSnackbar } = useSnackbar();
    const state = useCurriculumState();
    const curriculum = state.curriculums[curriculumId];

    const { createSyllabus } = useSyllabusActions();
    const { createModule } = useModuleActions();
    const { createEvent } = useModuleEventActions();

    const handleExport = useCallback(() => {
        if (!curriculum) return;
        try {
            const syllabusesData = curriculum.syllabuses.map((syllabusId) => {
                const syllabus = state.syllabuses[syllabusId];
                if (!syllabus) return null;
                const modules = (syllabus.modules ?? []).map((moduleId) => {
                    const moduleDoc = state.modules[moduleId];
                    if (!moduleDoc) return null;
                    const events = (moduleDoc.events ?? []).map((eventId) => {
                        const eventDoc = state.events[eventId];
                        if (!eventDoc) return null;
                        return {
                            title: eventDoc.title,
                            type: eventDoc.type,
                            minimumDuration: eventDoc.minimumDuration,
                            allocatedDuration: eventDoc.allocatedDuration,
                            constraints: eventDoc.constraints,
                        };
                    }).filter(Boolean);
                    return {
                        title: moduleDoc.title,
                        description: moduleDoc.description,
                        hiveIds: moduleDoc.hiveIds,
                        events,
                    };
                }).filter(Boolean);
                return {
                    title: syllabus.title,
                    hiveIds: syllabus.hiveIds,
                    modules,
                };
            }).filter(Boolean);

            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(syllabusesData, null, 2));
            const downloadAnchor = document.createElement("a");
            downloadAnchor.setAttribute("href", dataStr);
            downloadAnchor.setAttribute("download", `syllabuses_${curriculumId}.json`);
            document.body.appendChild(downloadAnchor);
            downloadAnchor.click();
            downloadAnchor.remove();
            enqueueSnackbar("הסילבוסים יוצאו בהצלחה!", { variant: "success" });
        } catch {
            enqueueSnackbar("ייצוא הסילבוסים נכשל!", { variant: "error" });
        }
    }, [curriculum, state, curriculumId, enqueueSnackbar]);

    const handleImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (event) => {
            try {
                const importedSyllabuses = JSON.parse(event.target?.result as string);
                if (!Array.isArray(importedSyllabuses)) {
                    throw new Error("Invalid format: expected an array of syllabuses");
                }

                enqueueSnackbar("מתחיל ייבוא סילבוסים...", { variant: "info" });

                for (const syllabusData of importedSyllabuses) {
                    const newSyllabus = await createSyllabus(
                        syllabusData.title || "סילבוס מיובא",
                        curriculumId,
                        syllabusData.hiveIds || []
                    );

                    if (Array.isArray(syllabusData.modules)) {
                        for (const moduleData of syllabusData.modules) {
                            const newModule = await createModule(
                                moduleData.title || "מערך מיובא",
                                newSyllabus.id,
                                moduleData.description || "",
                                moduleData.hiveIds || []
                            );

                            if (Array.isArray(moduleData.events)) {
                                for (const eventData of moduleData.events) {
                                    await createEvent(
                                        eventData.title || "מופע מיובא",
                                        newModule.id,
                                        eventData.type,
                                        eventData.minimumDuration || 0,
                                        eventData.allocatedDuration || 0
                                    );
                                }
                            }
                        }
                    }
                }

                enqueueSnackbar("ייבוא הסילבוסים הושלם בהצלחה!", { variant: "success" });
            } catch (error: any) {
                enqueueApiErrorSnackbar(enqueueSnackbar, "ייבוא הסילבוסים נכשל!", error);
            } finally {
                e.target.value = "";
            }
        };
        reader.readAsText(file);
    }, [curriculumId, createSyllabus, createModule, createEvent, enqueueSnackbar]);

    return (
        <Box alignItems="center" display="flex" gap={2} justifyContent="flex-start" {...props} width="100%">
            <CreateSyllabusButton curriculumId={curriculumId} />
            <SyllabusSelectionField
                alignItems={"center"}
                className="w-100"
                curriculumId={curriculumId}
                display="flex"
                flexDirection="row"
                gap={1}
            />
            <Box flexGrow={1} />
            <Button
                color="primary"
                onClick={handleExport}
                size="small"
                startIcon={<DownloadIcon />}
                sx={{ whiteSpace: "nowrap" }}
                variant="outlined"
            >
                ייצוא סילבוסים
            </Button>
            <Button
                color="secondary"
                component="label"
                size="small"
                startIcon={<UploadIcon />}
                sx={{ whiteSpace: "nowrap" }}
                variant="outlined"
            >
                ייבוא סילבוסים
                <input
                    accept=".json"
                    hidden
                    onChange={handleImport}
                    type="file"
                />
            </Button>
        </Box>
    );
}
