import { SyllabusId } from "@/api-shared/types/gant/curriculum";
import { ModuleItem } from "@/components/gant/curriculum-view/components/sidebars/syllabus-modules/ModuleItem";
import { useSyllabus } from "@/components/gant/state/hooks";
import { Box, BoxProps, Stack, Typography } from "@mui/material";
import { useMemo } from "react";

export interface SyllabusSectionProps extends BoxProps
{
    syllabusId: SyllabusId;
}

export function SyllabusSection({ syllabusId, ...props }: SyllabusSectionProps)
{
    const syllabus = useSyllabus(syllabusId);

    const moduleItems = useMemo(() =>
        (syllabus?.modules ?? []).map((m) => (
            <ModuleItem key={ m } moduleId={ m } />
        )),
        [ syllabus?.modules ]);

    return (
        <Box { ...props } className="flex flex-col pb-4">
            {/* Sticky Header: Visible until the entire section scrolls out */ }
            <Box className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm py-3 mb-2 shadow-sm">
                <Typography
                    variant="overline"
                    className="px-2 font-bold tracking-wider"
                    color="primary"
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
