import Typography from "@mui/material/Typography";
import { useCallback } from "react";

import { GanttCurriculumId } from "@/api-shared/types/gantt/models";
import { EditableCurriculumField } from "@/components/gantt/curriculum-view/components/curriculum-about-card/EditableCurriculumField";
import { useCurriculumList } from "@/components/gantt/state/curriculum-list";
import { useCurriculumActions } from "@/components/gantt/state/hooks/gantt-funcs/UseCurriculumActions";

export type CurriculumNameProps = {
    curriculumId: GanttCurriculumId | null;
    title?: string;
};

export function CurriculumName({ curriculumId, title }: CurriculumNameProps) {
    const { updateCurriculum } = useCurriculumActions();
    const { updateCurriculum: updateListCurriculum } = useCurriculumList();

    const saveNameHandler = useCallback(
        async (nextTitle: string) => {
            if (!curriculumId) {
                return;
            }
            await updateCurriculum(curriculumId, { title: nextTitle });
            updateListCurriculum(curriculumId, { title: nextTitle });
        },
        [ curriculumId, updateCurriculum, updateListCurriculum ],
    );

    return (
        <EditableCurriculumField
            allowEmpty={ false }
            canEdit={ Boolean(curriculumId) }
            editTooltip="עריכת שם התוכנית"
            onSave={ saveNameHandler }
            renderDisplay={ (value) => (
                <Typography color="primary" variant="h6">
                    { value }
                </Typography>
            ) }
            skeletonWidth="40%"
            value={ title }
        />
    );
}
