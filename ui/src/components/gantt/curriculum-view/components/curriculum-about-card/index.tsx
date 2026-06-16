import Box from "@mui/material/Box";
import Card, { CardProps } from "@mui/material/Card";

import Skeleton from "@mui/material/Skeleton";
import Typography from "@mui/material/Typography";

import { GanttCurriculumDocument } from "@/api-client/gantt/curriculum";
import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { CurriculumDescription } from "@/components/gantt/curriculum-view/components/curriculum-about-card/CurriculumDescription";
import { CurriculumName } from "@/components/gantt/curriculum-view/components/curriculum-about-card/CurriculumName";

export type CurriculumCardProps = {
    curriculumId: GanttCurriculumId | null;
    curriculum: GanttCurriculumDocument | undefined;
} & Omit<CardProps, "sx">;

export function CurriculumAboutCard({
    curriculumId,
    curriculum,
    ...props
}: CurriculumCardProps) {
    return (
        <Card sx={{ padding: 2, minWidth: "14rem", flexShrink: 0 }} {...props}>
            <CurriculumName
                curriculumId={curriculumId}
                title={curriculum?.title}
            />
            <CurriculumDescription
                curriculumId={curriculumId}
                description={curriculum?.description}
            />
            <Box color="textSecondary" display={"flex"} flexDirection={"row"}>
                <Typography color="textSecondary" variant="body2">
                    עדכון אחרון:
                </Typography>
                <Box width={"0.2rem"} />
                {curriculum?.updatedAt ? (
                    <Typography color="textSecondary">
                        {curriculum.updatedAt.format("DD/MM/YYYY")}
                    </Typography>
                ) : (
                    <Skeleton variant="text" width={80} />
                )}
            </Box>
        </Card>
    );
}
