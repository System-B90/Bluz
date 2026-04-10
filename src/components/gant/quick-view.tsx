import { useCurriculums } from "@/components/gant/providers/curriculum-provider";
import { Box } from "@mui/material";

export default function CurriculumQuickView()
{
    const { data: curriculumIds } = useCurriculums();

    return (
        <Box>

        </Box>
    );
}