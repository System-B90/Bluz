import { Box, Typography } from "@mui/material";

import { ConstraintType, GanttConstraint, RelationalConstraint, TemporalConstraint } from "@/api-shared/types/gantt/models/constraint";
import { GanttDayIndex } from "@/api-shared/types/gantt/models/day";
import { WeekDayVisualizer } from "@/components/gantt/module-dialog/constraints/TemporalDraftFields";
import { useCurriculumState } from "@/components/gantt/state/provider";

function RelationalConstraintHumanReadableEntry({ constraint }: { constraint: RelationalConstraint; }) {
    const state = useCurriculumState();

    const target = constraint.targetType === 'module'
        ? state.modules[constraint.targetId]
        : state.events[constraint.targetId];

    const ownerTypeName = constraint.ownerType === 'event' ? 'המופע' : 'המערך';
    const targetTypeName = constraint.targetType === 'module' ? 'המערך' : 'המופע';

    const ownerName = (constraint.ownerType === 'event' ? state.events[constraint.ownerEventId]?.title : state.modules[constraint.ownerModuleId]?.title) ?? '*לא נמצא*';

    const hasMin = constraint.minDelayDays !== undefined && constraint.minDelayDays !== null;
    const hasMax = constraint.maxDelayDays !== undefined && constraint.maxDelayDays !== null;

    let delayPhrase = "";
    if (hasMin && hasMax) {
        if (constraint.minDelayDays === constraint.maxDelayDays) {
            delayPhrase = `בדיוק ${constraint.minDelayDays} ימים`;
        } else {
            delayPhrase = `בין ${constraint.minDelayDays} ל-${constraint.maxDelayDays} ימים`;
        }
    } else if (hasMin) {
        delayPhrase = `לפחות ${constraint.minDelayDays} ימים`;
    } else if (hasMax) {
        delayPhrase = `לכל היותר ${constraint.maxDelayDays} ימים`;
    }

    return (
        <Box alignItems='center' display='flex' flexDirection='row' flexWrap='wrap'>
            <Typography color='text.primary' variant='body2'>
                {ownerTypeName}
            </Typography>
            <Box width='0.2rem' />
            <Typography color='primary' fontStyle={'italic'} variant='body2'>
                {ownerName}
            </Typography>
            <Box width='0.2rem' />
            <Typography color='text.primary' variant='body2'>
                {constraint.relation === 'after' ? 'יתחיל' : 'יסתיים'}
            </Typography>
            {!!delayPhrase && (
                <>
                    <Box width='0.2rem' />
                    <Typography color='secondary.main' fontWeight='medium' variant='body2'>
                        {delayPhrase}
                    </Typography>
                </>
            )}
            <Box width='0.2rem' />
            <Typography color='text.primary' variant='body2'>
                {constraint.relation === 'after' ? 'אחרי' : 'לפני'}
            </Typography>
            <Box width='0.2rem' />
            <Typography color='text.primary' variant='body2'>
                ש{targetTypeName}
            </Typography>
            <Box width='0.2rem' />
            <Typography color='primary' fontStyle={'italic'} variant='body2'>
                {target?.title ?? '*לא נמצא*'}
            </Typography>
            <Box width='0.2rem' />
            <Typography color='text.primary' variant='body2'>
                {constraint.relation === 'after' ? 'יסתיים' : 'יתחיל'}
            </Typography>
        </Box>
    );
}

function TemporalConstraintHumanReadableEntry({ constraint }: { constraint: TemporalConstraint; }) {
    const validDays = new Set(((constraint.allowedDays?.length === 0 ? undefined : constraint.allowedDays) ?? [
        GanttDayIndex.Sunday,
        GanttDayIndex.Monday,
        GanttDayIndex.Tuesday,
        GanttDayIndex.Wednesday,
        GanttDayIndex.Thursday,
        GanttDayIndex.Friday,
        GanttDayIndex.Saturday
    ])?.filter((d) => !((constraint.forbiddenDays?.length === 0 ? undefined : constraint.forbiddenDays) ?? []).includes(d)));

    return (<WeekDayVisualizer validDays={validDays} />);
}

export function ConstraintHumanReadableEntry({ constraint }: { constraint: GanttConstraint; }) {
    return constraint.type === ConstraintType.Relational ? <RelationalConstraintHumanReadableEntry constraint={constraint} /> : <TemporalConstraintHumanReadableEntry constraint={constraint} />;
}
