import {
    SortableContext,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import Box from "@mui/material/Box";
import BoxProps from "@mui/material/BoxProps";
import Stack from "@mui/material/Stack";
import { useTheme } from "@mui/material/styles";
import Typography from "@mui/material/Typography";
import { useMemo } from "react";

import { GanttSyllabusId } from "@/api-shared/types/gantt/models";
import { ModuleItem } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/syllabus-modules/ModuleItem";
import { hashSyllabusToColor } from "@/components/gantt/curriculum-view/tabs/builder-tab/components/utils";
import { useSyllabus } from "@/components/gantt/state/hooks/UseSyllabus";
import { useGanttMappings } from "@/components/gantt/state/mappings/hooks";

export type SyllabusSectionProps = {
    syllabusId: GanttSyllabusId;
} & BoxProps;

export function SyllabusSection({
    syllabusId,
    ...props
}: SyllabusSectionProps) {
    const theme = useTheme();
    const {
        state: { mappings },
    } = useGanttMappings();
    const syllabus = useSyllabus(syllabusId);
    const color = useMemo(
        () => hashSyllabusToColor(syllabusId, theme.palette.primary.main, 0.2),
        [syllabusId, theme.palette.primary.main],
    );

    const unmappedModuleIds = useMemo(
        () =>
            (syllabus?.modules ?? []).filter(
                (m) => !Object.values(mappings).some((x) => x.moduleId === m),
            ),
        [syllabus?.modules, mappings],
    );

    return (
        <Box {...props} className="flex flex-col pb-4">
            {/* Sticky Header */}
            <Box
                bgcolor={color}
                className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm py-2 mb-2 shadow-sm"
            >
                <Typography
                    className="px-2 font-bold tracking-wider"
                    color="textPrimary"
                    fontSize="1rem"
                    fontWeight={700}
                    variant="overline"
                >
                    {syllabus?.title ?? "Unnamed Syllabus"}
                </Typography>
            </Box>

            <SortableContext
                items={unmappedModuleIds}
                strategy={verticalListSortingStrategy}
            >
                <Stack
                    className="px-2 overflow-y-auto"
                    spacing={1}
                    sx={{
                        maxHeight: 242,
                        "&::-webkit-scrollbar": {
                            width: "6px",
                        },
                        "&::-webkit-scrollbar-thumb": {
                            backgroundColor: "rgba(0, 0, 0, 0.1)",
                            borderRadius: "4px",
                        },
                        "&::-webkit-scrollbar-thumb:hover": {
                            backgroundColor: "rgba(0, 0, 0, 0.2)",
                        },
                    }}
                >
                    {unmappedModuleIds.map((m) => (
                        <ModuleItem
                            key={m}
                            moduleId={m}
                            syllabusId={syllabusId}
                        />
                    ))}
                </Stack>
            </SortableContext>
        </Box>
    );
}
