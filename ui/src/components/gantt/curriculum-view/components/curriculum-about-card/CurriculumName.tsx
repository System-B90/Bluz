import { Typography } from "@mui/material";
import { useCallback } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { EditableCurriculumField } from "@/components/gantt/curriculum-view/components/curriculum-about-card/EditableCurriculumField";
import { useCurriculumActions } from "@/components/gantt/state/hooks/gantt-funcs/UseCurriculumActions";

export type CurriculumNameProps = {
  curriculumId: GanttCurriculumId | null;
  title?: string;
}

export function CurriculumName({ curriculumId, title }: CurriculumNameProps) {
    const { updateCurriculum } = useCurriculumActions();
    const saveNameHandler = useCallback(
        async (nextTitle: string) => {
            if (!curriculumId) {
                return;
            }
            await updateCurriculum(curriculumId, { title: nextTitle });
        },
        [curriculumId, updateCurriculum],
    );

    return (
        <EditableCurriculumField
            allowEmpty={false}
            canEdit={Boolean(curriculumId)}
            editTooltip="שינוי שם תכנית"
            onSave={saveNameHandler}
            renderDisplay={(value) => (
                <Typography color="primary" variant="h6">
                    {value}
                </Typography>
            )}
            skeletonWidth="40%"
            value={title}
        />
    );
}
