"use client";

import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DeleteIcon from "@mui/icons-material/Delete";
import
{
    Box,
    Button,
    Card,
    CardContent,
    CircularProgress,
    IconButton,
    ListSubheader,
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography,
} from "@mui/material";
import { useMemo, useState } from "react";

import { CreateConstraintPayload } from "@/api-client/gantt/constraints";
import { GanttModuleId } from "@/api-shared/types/gantt/models";
import { ConstraintType } from "@/api-shared/types/gantt/models/constraint";
import { useGanttConstraints } from "@/components/gantt/state/constraints/hooks";
import { useCurriculumState } from "@/components/gantt/state/provider";

type TargetOption = {
    id: string;
    label: string;
    type: "event" | "module";
    syllabusId: string;
};
type RelationalDraft = {
    type: ConstraintType.Relational;
    targetId: string;
    relation: "after" | "before";
    minDelay?: string;
    maxDelay?: string;
};
type TemporalDraft = {
    type: ConstraintType.Temporal;
    allowedDays: string;
    forbiddenDays: string;
};
type DraftConstraint = RelationalDraft | TemporalDraft;

function useTargetOptions()
{
    const state = useCurriculumState();

    return useMemo(() =>
    {
        const result: Record<string, Array<TargetOption>> = {};

        for (const syllabus of Object.values(state.syllabuses))
        {
            result[ syllabus.id ] = [];
        }

        for (const ganttModule of Object.values(state.modules))
        {
            const syllabus = state.syllabuses[ ganttModule.syllabusId ];
            const label = `${syllabus.title} / ${ganttModule.title}`;

            result[ ganttModule.syllabusId ].push({
                id: ganttModule.id,
                label,
                type: "module",
                syllabusId: ganttModule.syllabusId,
            });

            for (const eventId of ganttModule.events)
            {
                const event = state.events[ eventId ];
                if (!event) continue;

                result[ ganttModule.syllabusId ].push({
                    id: event.id,
                    label: `${label} / ${event.title}`,
                    type: "event",
                    syllabusId: ganttModule.syllabusId,
                });
            }
        }

        for (const group of Object.values(result))
        {
            group.sort((a, b) => a.label.localeCompare(b.label));
        }

        return result;
    }, [ state ]);
}

function ConstraintListItem({
    constraint,
    onRemove,
}: {
    constraint: any;
    onRemove: (id: string) => void;
})
{
    return (
        <Box
            alignItems="center"
            border={ 1 }
            borderColor="divider"
            borderRadius={ 1 }
            display="flex"
            justifyContent="space-between"
            p={ 1 }
        >
            <Typography variant="body2">
                { constraint.type === ConstraintType.Relational ? "אילוץ יחסי" : "אילוץ זמן" }
            </Typography>

            <IconButton
                color="error"
                onClick={ () => onRemove(constraint.id) }
                size="small"
            >
                <DeleteIcon fontSize="small" />
            </IconButton>
        </Box>
    );
}

function RelationalDraftFields({
    draft,
    setDraft,
    targetOptions,
    curriculumState,
}: {
    draft: RelationalDraft;
    setDraft: (draft: DraftConstraint) => void;
    targetOptions: Record<string, Array<TargetOption>>;
    curriculumState: any;
})
{
    return (
        <Stack direction="row" spacing={ 1 }>
            <Select
                displayEmpty
                MenuProps={ { PaperProps: { style: { maxHeight: 400 } } } }
                onChange={ (e) => setDraft({ ...draft, targetId: e.target.value }) }
                renderValue={ (value) =>
                {
                    if (!value) return "בחר יעד";
                    for (const group of Object.values(targetOptions))
                    {
                        const found = group.find((o) => o.id === value);
                        if (found) return found.label;
                    }
                    return value;
                } }
                size="small"
                value={ draft.targetId }
            >
                { Object.entries(targetOptions).map(([ syllabusId, options ]) =>
                {
                    const syllabus = curriculumState.syllabuses[ syllabusId ];
                    return [
                        <ListSubheader key={ `header-${syllabusId}` }>
                            { syllabus.title }
                        </ListSubheader>,
                        ...options.map((option) => (
                            <MenuItem key={ option.id } value={ option.id }>
                                { option.label }
                            </MenuItem>
                        )),
                    ];
                }) }
            </Select>

            <Select
                onChange={ (e) =>
                    setDraft({ ...draft, relation: e.target.value as "after" | "before" })
                }
                size="small"
                value={ draft.relation }
            >
                <MenuItem value="after">אחרי</MenuItem>
                <MenuItem value="before">לפני</MenuItem>
            </Select>

            <TextField
                label="Min"
                onChange={ (e) => setDraft({ ...draft, minDelay: e.target.value }) }
                size="small"
                type="number"
                value={ draft.minDelay || "" }
            />

            <TextField
                label="Max"
                onChange={ (e) => setDraft({ ...draft, maxDelay: e.target.value }) }
                size="small"
                type="number"
                value={ draft.maxDelay || "" }
            />
        </Stack>
    );
}

function TemporalDraftFields({
    draft,
    setDraft,
}: {
    draft: TemporalDraft;
    setDraft: (draft: DraftConstraint) => void;
})
{
    return (
        <Stack direction="row" spacing={ 1 }>
            <TextField
                label="Allowed"
                onChange={ (e) => setDraft({ ...draft, allowedDays: e.target.value }) }
                size="small"
                value={ draft.allowedDays }
            />
            <TextField
                label="Forbidden"
                onChange={ (e) => setDraft({ ...draft, forbiddenDays: e.target.value }) }
                size="small"
                value={ draft.forbiddenDays }
            />
        </Stack>
    );
}

function DraftConstraintForm({
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
    const handleTypeChange = (nextType: ConstraintType) =>
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
                allowedDays: "",
                forbiddenDays: "",
            });
        }
    };

    return (
        <Box border={ 1 } borderColor="primary.main" borderRadius={ 1 } p={ 1 }>
            <Stack spacing={ 1 }>
                <Select
                    onChange={ (e) => handleTypeChange(e.target.value as ConstraintType) }
                    size="small"
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
                    <TemporalDraftFields draft={ draft } setDraft={ setDraft } />
                ) }

                <Stack direction="row" justifyContent="flex-end" spacing={ 1 }>
                    <IconButton color="primary" onClick={ onSubmit }>
                        <CheckIcon />
                    </IconButton>
                    <IconButton onClick={ onCancel }>
                        <CloseIcon />
                    </IconButton>
                </Stack>
            </Stack>
        </Box>
    );
}

export function ModuleConstraintsView({
    moduleId,
}: {
    moduleId: GanttModuleId;
})
{
    const targetOptions = useTargetOptions();
    const curriculumState = useCurriculumState();
    const { state, removeConstraint, createConstraint } = useGanttConstraints();

    const [ draft, setDraft ] = useState<DraftConstraint | null>(null);

    const constraintsList = useMemo(
        () => Object.values(state.constraints),
        [ state.constraints ]
    );

    const handleStartCreate = () =>
    {
        setDraft({
            type: ConstraintType.Relational,
            targetId: "",
            relation: "after",
            minDelay: "",
            maxDelay: "",
        });
    };

    const handleCancelCreate = () =>
    {
        setDraft(null);
    };

    const handleSubmitCreate = async () =>
    {
        if (!draft) return;

        let payload: CreateConstraintPayload;

        if (draft.type === ConstraintType.Relational)
        {
            payload = {
                type: ConstraintType.Relational,
                ownerType: "module",
                ownerModuleId: moduleId,
                // @ts-ignore 
                targetId: draft.targetId,
                targetType: "module",
                relation: draft.relation,
                minDelayDays: draft.minDelay ? Number(draft.minDelay) : undefined,
                maxDelayDays: draft.maxDelay ? Number(draft.maxDelay) : undefined,
            };
        } else
        {
            payload = {
                type: ConstraintType.Temporal,
                ownerType: "module",
                ownerModuleId: moduleId,
                // @ts-ignore 
                allowedDays: draft.allowedDays
                    ? draft.allowedDays.split(",").map((d) => Number(d.trim()))
                    : undefined,
                forbiddenDays: draft.forbiddenDays
                    ? draft.forbiddenDays.split(",").map((d) => Number(d.trim()))
                    : undefined,
            };
        }

        await createConstraint(payload);
        setDraft(null);
    };

    return (
        <Card variant="outlined">
            <CardContent>
                <Stack
                    alignItems="center"
                    direction="row"
                    justifyContent="space-between"
                    mb={ 2 }
                >
                    <Typography variant="h6">אילוצים</Typography>
                    <Button
                        color="primary"
                        disabled={ !!draft }
                        onClick={ handleStartCreate }
                        size="small"
                        variant="outlined"
                    >
                        הוספת אילוץ
                    </Button>
                </Stack>

                { state.isLoading ? (
                    <Box display="flex" justifyContent="center" p={ 2 }>
                        <CircularProgress size={ 24 } />
                    </Box>
                ) : (
                    <Stack spacing={ 1 }>
                        { constraintsList.map((constraint) => (
                            <ConstraintListItem
                                constraint={ constraint }
                                key={ constraint.id }
                                onRemove={ removeConstraint }
                            />
                        )) }

                        { draft ? <DraftConstraintForm
                            curriculumState={ curriculumState }
                            draft={ draft }
                            onCancel={ handleCancelCreate }
                            onSubmit={ handleSubmitCreate }
                            setDraft={ setDraft }
                            targetOptions={ targetOptions }
                        /> : null }

                        { constraintsList.length === 0 && !draft && (
                            <Typography color="text.secondary" variant="body2">
                                לא הוגדרו אילוצים למערך זה.
                            </Typography>
                        ) }
                    </Stack>
                ) }
            </CardContent>
        </Card>
    );
}
