import { useCurriculum } from "@/components/curriculum/curriculum-provider";
import { Box } from "@mui/material";

export default function CurriculumQuickView()
{
    const { data: curriculumIds } = useCurriculum();

    return (
        <Box>

        </Box>
    );
}