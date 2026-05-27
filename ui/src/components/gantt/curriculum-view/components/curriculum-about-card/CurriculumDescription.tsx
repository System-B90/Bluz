import { Typography } from "@mui/material";
import { useCallback } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { EditableCurriculumField } from "@/components/gantt/curriculum-view/components/curriculum-about-card/EditableCurriculumField";
import { useCurriculumActions } from "@/components/gantt/state/hooks/gantt-funcs/UseCurriculumActions";

export type CurriculumDescriptionProps = {
  curriculumId: GanttCurriculumId | null;
  description?: string;
};

export function CurriculumDescription({
    curriculumId,
    description,
}: CurriculumDescriptionProps) {
    const { updateCurriculum } = useCurriculumActions();
    const saveDescriptionHandler = useCallback(
        async (nextDescription: string) => {
            if (!curriculumId) {
                return;
            }
            await updateCurriculum(curriculumId, { description: nextDescription });
        },
        [curriculumId, updateCurriculum],
    );

    return (
        <EditableCurriculumField
            allowEmpty
            canEdit={Boolean(curriculumId)}
            editTooltip="ערוך תיאור תכנית"
            minRows={2}
            multiline
            onSave={saveDescriptionHandler}
            renderDisplay={(value) => (
                <Typography
                    color="secondary"
                    sx={{ whiteSpace: "pre-wrap" }}
                    variant="body1"
                >
                    {value}
                </Typography>
            )}
            skeletonWidth="100%"
            value={description}
        />
    );
}
