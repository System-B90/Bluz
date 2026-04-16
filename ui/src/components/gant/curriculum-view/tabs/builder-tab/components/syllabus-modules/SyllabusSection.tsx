import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Box, BoxProps, Stack, Typography, useTheme } from "@mui/material";
import { useMemo } from "react";

import { SyllabusId } from "@/api-shared/types/gant/curriculum";
import { useCurriculumMappings } from "@/components/gant/curriculum-view/tabs/builder-tab/components/CurriculumModuleDayMappingsProvider";
import { ModuleItem } from "@/components/gant/curriculum-view/tabs/builder-tab/components/syllabus-modules/ModuleItem";
import { hashSyllabusToColor } from "@/components/gant/curriculum-view/tabs/builder-tab/components/utils";
import { useSyllabus } from "@/components/gant/state/hooks/UseSyllabus";

export interface SyllabusSectionProps extends BoxProps
{
    syllabusId: SyllabusId;
}

export function SyllabusSection({ syllabusId, ...props }: SyllabusSectionProps)
{
    const theme = useTheme();
    const { state: { mappings } } = useCurriculumMappings();
    const syllabus = useSyllabus(syllabusId);
    const color = useMemo(() => hashSyllabusToColor(syllabusId, theme.palette.primary.main, 0.2), [ syllabusId, theme.palette.primary.main ]);

    const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
        id: `syllabus-${syllabusId}`,
        data: { type: "SYLLABUS", syllabusId },
    });

    const style = {
        ...props.style,
        transform: CSS.Translate.toString(transform),
        transition: isDragging ? undefined : "transform 200ms ease",
    };

    const moduleItems = useMemo(() =>
        (syllabus?.modules ?? [])
            .filter((m) => !Object.values(mappings).some((x) => x.moduleId === m))
            .map((m) => (
                <ModuleItem key={ m } moduleId={ m } />
            )),
        [ syllabus?.modules, mappings ]);

    return (
        <Box
            { ...props }
            className="flex flex-col pb-4"
            ref={ setNodeRef }
            style={ style }
            { ...attributes }
            { ...listeners }
        >
            {/* Sticky Header: Visible until the entire section scrolls out */ }
            <Box className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm py-2 mb-2 shadow-sm" bgcolor={ color }>
                <Typography
                    variant="overline"
                    className="px-2 font-bold tracking-wider"
                    fontSize='1rem'
                    fontWeight={ 700 }
                    color='textPrimary'
                >
                    { syllabus?.title ?? 'Unnamed Syllabus' }
                </Typography>
            </Box>

            <Stack spacing={ 1 } className="px-2">
                { moduleItems }
            </Stack>
        </Box>
    );
}
