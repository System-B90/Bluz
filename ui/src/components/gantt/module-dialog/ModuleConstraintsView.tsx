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
    MenuItem,
    Select,
    Stack,
    TextField,
    Typography
} from "@mui/material";
import { ListSubheader } from "@mui/material";
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

        for (const module of Object.values(state.modules))
        {
            const syllabus = state.syllabuses[ module.syllabusId ];

            const label = `${syllabus.title} / ${module.title}`;

            result[ module.syllabusId ].push({
                id: module.id,
                label,
                type: "module",
                syllabusId: module.syllabusId
            });

            // OPTIONAL: include events
            for (const eventId of module.events)
            {
                const event = state.events[ eventId ];
                if (!event) continue;

                result[ module.syllabusId ].push({
                    id: event.id,
                    label: `${label} / ${event.title}`,
                    type: "event",
                    syllabusId: module.syllabusId
                });
            }
        }

        // sort each group
        for (const group of Object.values(result))
        {
            group.sort((a, b) => a.label.localeCompare(b.label));
        }

        return result;
    }, [ state ]);
}
type DraftConstraint =
    | {
        type: ConstraintType.Relational;
        targetId: string;
        relation: "after" | "before";
        minDelay?: string;
        maxDelay?: string;
    }
    | {
        type: ConstraintType.Temporal;
        allowedDays: string;
        forbiddenDays: string;
    };

export function ModuleConstraintsView({ moduleId }: { moduleId: GanttModuleId; })
{
    const targetOptions = useTargetOptions();
    const curriculumState = useCurriculumState();
    const { state, removeConstraint, createConstraint } = useGanttConstraints();

    const [ draft, setDraft ] = useState<DraftConstraint | null>(null);

    const constraintsList = useMemo(
        () => Object.values(state.constraints),
        [ state.constraints ]
    );

    function startCreate()
    {
        setDraft({
            type: ConstraintType.Relational,
            targetId: "",
            relation: "after",
            minDelay: "",
            maxDelay: ""
        });
    }

    function cancelCreate()
    {
        setDraft(null);
    }

    async function submitCreate()
    {
        if (!draft) return;

        if (draft.type === ConstraintType.Relational)
        {
            await createConstraint({
                type: ConstraintType.Relational,
                ownerType: "module",
                ownerModuleId: moduleId,
                targetId: draft.targetId,
                targetType: "module",
                relation: draft.relation,
                minDelayDays: draft.minDelay ? Number(draft.minDelay) : undefined,
                maxDelayDays: draft.maxDelay ? Number(draft.maxDelay) : undefined
            } as CreateConstraintPayload);
        }
        else
        {
            await createConstraint({
                type: ConstraintType.Temporal,
                ownerType: "module",
                ownerModuleId: moduleId,
                allowedDays: draft.allowedDays
                    ? draft.allowedDays.split(",").map((d) => Number(d.trim()))
                    : undefined,
                forbiddenDays: draft.forbiddenDays
                    ? draft.forbiddenDays.split(",").map((d) => Number(d.trim()))
                    : undefined
            } as CreateConstraintPayload);
        }

        setDraft(null);
    }

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
                        onClick={ startCreate }
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
                            <Box
                                alignItems="center"
                                border={ 1 }
                                borderColor="divider"
                                borderRadius={ 1 }
                                display="flex"
                                justifyContent="space-between"
                                key={ constraint.id }
                                p={ 1 }
                            >
                                <Typography variant="body2">
                                    { constraint.type === ConstraintType.Relational
                                        ? "אילוץ יחסי"
                                        : "אילוץ זמן" }
                                </Typography>

                                <IconButton
                                    color="error"
                                    onClick={ () => removeConstraint(constraint.id) }
                                    size="small"
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>
                            </Box>
                        )) }

                        {/* INLINE CREATION ROW */ }
                        { draft ? <Box
                            border={ 1 }
                            borderColor="primary.main"
                            borderRadius={ 1 }
                            p={ 1 }
                        >
                            <Stack spacing={ 1 }>
                                <Select
                                    onChange={ (e) =>
                                    {
                                        const nextType = e.target.value as ConstraintType;

                                        if (nextType === ConstraintType.Relational)
                                        {
                                            setDraft({
                                                type: ConstraintType.Relational,
                                                targetId: "",
                                                relation: "after",
                                                minDelay: "",
                                                maxDelay: ""
                                            });
                                        }
                                        else
                                        {
                                            setDraft({
                                                type: ConstraintType.Temporal,
                                                allowedDays: "",
                                                forbiddenDays: ""
                                            });
                                        }
                                    } }
                                    size="small"
                                    value={ draft.type }
                                >
                                    <MenuItem value={ ConstraintType.Relational }>
                                            אילוץ יחסי
                                    </MenuItem>
                                    <MenuItem value={ ConstraintType.Temporal }>
                                            אילוץ זמן
                                    </MenuItem>
                                </Select>

                                { draft.type === ConstraintType.Relational && (
                                    <Stack direction="row" spacing={ 1 }>
                                        <Select
                                            displayEmpty
                                            MenuProps={ {
                                                PaperProps: {
                                                    style: { maxHeight: 400 }
                                                }
                                            } }
                                            onChange={ (e) =>
                                                setDraft({
                                                    ...draft,
                                                    targetId: e.target.value
                                                })
                                            }
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
                                                    ))
                                                ];
                                            }) }
                                        </Select>

                                        <Select
                                            onChange={ (e) =>
                                                setDraft({
                                                    ...draft,
                                                    relation: e.target.value as "after" | "before"
                                                })
                                            }
                                            size="small"
                                            value={ draft.relation }
                                        >
                                            <MenuItem value="after">אחרי</MenuItem>
                                            <MenuItem value="before">לפני</MenuItem>
                                        </Select>

                                        <TextField
                                            label="Min"
                                            onChange={ (e) =>
                                                setDraft({ ...draft, minDelay: e.target.value })
                                            }
                                            size="small"
                                            type="number"
                                            value={ draft.minDelay }
                                        />

                                        <TextField
                                            label="Max"
                                            onChange={ (e) =>
                                                setDraft({ ...draft, maxDelay: e.target.value })
                                            }
                                            size="small"
                                            type="number"
                                            value={ draft.maxDelay }
                                        />
                                    </Stack>
                                ) }

                                { draft.type === ConstraintType.Temporal && (
                                    <Stack direction="row" spacing={ 1 }>
                                        <TextField
                                            label="Allowed"
                                            onChange={ (e) =>
                                                setDraft({
                                                    ...draft,
                                                    allowedDays: e.target.value
                                                })
                                            }
                                            size="small"
                                            value={ draft.allowedDays }
                                        />
                                        <TextField
                                            label="Forbidden"
                                            onChange={ (e) =>
                                                setDraft({
                                                    ...draft,
                                                    forbiddenDays: e.target.value
                                                })
                                            }
                                            size="small"
                                            value={ draft.forbiddenDays }
                                        />
                                    </Stack>
                                ) }

                                <Stack direction="row" justifyContent="flex-end" spacing={ 1 }>
                                    <IconButton color="primary" onClick={ submitCreate }>
                                        <CheckIcon />
                                    </IconButton>
                                    <IconButton onClick={ cancelCreate }>
                                        <CloseIcon />
                                    </IconButton>
                                </Stack>
                            </Stack>
                        </Box> : null }

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
