import { Box, Typography } from "@mui/material";

import { ConstraintType, GanttConstraint, RelationalConstraint, TemporalConstraint } from "@/api-shared/types/gantt/models/constraint";
import { GanttDayIndex } from "@/api-shared/types/gantt/models/day";
import { WeekDayVisualizer } from "@/components/gantt/module-dialog/constraints/TemporalDraftFields";
import { useCurriculumState } from "@/components/gantt/state/provider";

function RelationalConstraintHumanReadableEntry({ constraint }: { constraint: RelationalConstraint; })
{
    const state = useCurriculumState();

    const target = constraint.targetType === 'module'
        ? state.modules[ constraint.targetId ]
        : state.events[ constraint.targetId ];

    const ownerTypeName = constraint.ownerType === 'event' ? 'המופע' : 'המערך';
    const targetTypeName = constraint.targetType === 'module' ? 'המערך' : 'המופע';

    const ownerName = (constraint.ownerType === 'event' ? state.events[ constraint.ownerEventId ]?.title : state.modules[ constraint.ownerModuleId ]?.title) ?? '*לא נמצא*';

    return (
        <Box display='flex' flexDirection='row'>
            <Typography color='text.primary' variant='body2'>
                { ownerTypeName }
            </Typography>
            <Box width='0.3rem' />
            <Typography color='primary' fontStyle={ 'italic' } variant='body2'>
                { ownerName }
            </Typography>
            <Box width='0.3rem' />
            <Typography color='text.primary' variant='body2'>
                { constraint.relation === 'after' ? 'יתחיל אחרי ש' : 'יסתיים לפני ש' }
            </Typography>
            <Typography color='text.primary' variant='body2'>
                { targetTypeName }
            </Typography>
            <Box width='0.3rem' />
            <Typography color='primary' fontStyle={ 'italic' } variant='body2'>
                { target?.title ?? '*לא נמצא*' }
            </Typography>
            <Box width='0.3rem' />
            <Typography color='text.primary' variant='body2'>
                { constraint.relation === 'after' ? 'יסתיים' : 'יתחיל' }
            </Typography>
        </Box>
    );
}

function TemporalConstraintHumanReadableEntry({ constraint }: { constraint: TemporalConstraint; })
{
    const validDays = new Set(((constraint.allowedDays?.length === 0 ? undefined : constraint.allowedDays) ?? [
        GanttDayIndex.Sunday,
        GanttDayIndex.Monday,
        GanttDayIndex.Tuesday,
        GanttDayIndex.Wednesday,
        GanttDayIndex.Thursday,
        GanttDayIndex.Friday,
        GanttDayIndex.Saturday
    ])?.filter((d) => !((constraint.forbiddenDays?.length === 0 ? undefined : constraint.forbiddenDays) ?? []).includes(d)));

    return (<WeekDayVisualizer validDays={ validDays } />);
}

export function ConstraintHumanReadableEntry({ constraint }: { constraint: GanttConstraint; })
{
    return constraint.type === ConstraintType.Relational ? <RelationalConstraintHumanReadableEntry constraint={ constraint } /> : <TemporalConstraintHumanReadableEntry constraint={ constraint } />;
}
