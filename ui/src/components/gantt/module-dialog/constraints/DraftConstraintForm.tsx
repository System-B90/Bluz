import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import { Box, IconButton, MenuItem, Select, Stack } from "@mui/material";
import { useCallback } from "react";

import { RelationalDraftFields } from "@/components/gantt/module-dialog/constraints/RelationalDraftFields";
import { TemporalDraftFields } from "@/components/gantt/module-dialog/constraints/TemporalDraftFields";
import { DraftConstraint, TargetOption } from "@/components/gantt/module-dialog/constraints/types";

import { ConstraintType } from "@/api-shared/types/gantt/models/constraint";

export function DraftConstraintForm({
    draft,
    setDraft,
    onSubmit,
    onCancel,
    targetOptions,
    curriculumState,
}: {
    draft: DraftConstraint;
    setDraft: (draft: DraftConstraint) => void;
    onSubmit: () => void;
    onCancel: () => void;
    targetOptions: Record<string, Array<TargetOption>>;
    curriculumState: any;
})
{
    const handleTypeChange = useCallback((nextType: ConstraintType) =>
    {
        if (nextType === ConstraintType.Relational)
        {
            setDraft({
                type: ConstraintType.Relational,
                targetId: "",
                relation: "after",
                minDelay: "",
                maxDelay: "",
            });
        } else
        {
            setDraft({
                type: ConstraintType.Temporal,
                allowedDays: [],
                forbiddenDays: [],
            });
        }
    }, [ setDraft ]);

    return (
        <Box border={ 1 } borderColor="primary.main" borderRadius={ 1 } p={ 1 }>
            <Stack direction='row' justifyContent="space-between" spacing={ 1 }>
                <Stack direction='row' flexGrow={ 1 } spacing={ 1 }>
                    <Select onChange={ (e) => handleTypeChange(e.target.value as ConstraintType) }
                        size="small"
                        sx={ { flexShrink: 0, minWidth: '8rem' } }
                        value={ draft.type }
                    >
                        <MenuItem value={ ConstraintType.Relational }>אילוץ יחסי</MenuItem>
                        <MenuItem value={ ConstraintType.Temporal }>אילוץ זמן</MenuItem>
                    </Select>

                    { draft.type === ConstraintType.Relational ? (
                        <RelationalDraftFields
                            curriculumState={ curriculumState }
                            draft={ draft }
                            setDraft={ setDraft }
                            targetOptions={ targetOptions }
                        />
                    ) : (
                        <TemporalDraftFields draft={ draft as any } setDraft={ setDraft as any } />
                    ) }
                </Stack>

                <Stack direction="row" flexShrink={ 1 } justifyContent="flex-end" spacing={ 0 }>
                    <IconButton color="error" onClick={ onCancel }>
                        <CloseIcon fontSize='small' />
                    </IconButton>
                    <IconButton color="primary" onClick={ onSubmit }>
                        <CheckIcon />
                    </IconButton>
                </Stack>
            </Stack>
        </Box>
    );
}
