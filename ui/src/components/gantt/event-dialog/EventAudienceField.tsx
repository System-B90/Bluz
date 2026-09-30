import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { useCallback, useMemo, useState } from "react";

import { isShuffleCourse } from "@/api-shared/course-tree";
import { Course } from "@/api-shared/types/course";
import {
    GanttEvent,
    GanttEventId,
    GanttModuleId,
    GanttSyllabus,
} from "@/api-shared/types/gantt/models";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useCourses } from "@/components/base/CoursesProvider";
import {
    describeGroupChange,
    EventShuffleGroupField,
    useShuffleGroupMembers,
} from "@/components/gantt/event-dialog/EventShuffleGroupField";
import { useModuleEventActions } from "@/components/gantt/state/hooks/gantt-funcs/UseModuleEventActions";

/** Who attends an event: everyone in the syllabus, some shuffles, or some courses. */
export type EventAudienceMode = "all" | "courses" | "shuffles";

export function getEventAudienceMode(event: GanttEvent): EventAudienceMode {
    if ((event.courseIds ?? []).length > 0) return "courses";
    if (event.groupId || (event.shuffles ?? []).length > 0) return "shuffles";
    return "all";
}

type CourseOption = { course: Course; depth: number };

/**
 * The courses an event may be limited to: the syllabus' own courses and their
 * sub-courses, as an indented tree. A syllabus without courses belongs to the
 * root, so the whole tree is on offer. Shuffle courses are left out —
 * shuffles are picked in their own mode.
 */
function useCourseOptions(syllabus: GanttSyllabus | null | undefined): Array<CourseOption> {
    const { courses } = useCourses();
    return useMemo(() => {
        const tree = courses.filter((course) => !isShuffleCourse(course));
        const known = new Set(tree.map((course) => course.id));
        const childrenOf = new Map<null | string, Array<Course>>();
        for (const course of tree) {
            const parentId = course.parentId && known.has(course.parentId) ? course.parentId : null;
            childrenOf.set(parentId, [...(childrenOf.get(parentId) ?? []), course]);
        }
        const own = (syllabus?.courseIds ?? []).filter((id) => known.has(id));
        const tops = own.length > 0
            ? tree.filter((course) => own.includes(course.id))
            : childrenOf.get(null) ?? [];

        const options: Array<CourseOption> = [];
        const seen = new Set<string>();
        const visit = (course: Course, depth: number) => {
            if (seen.has(course.id)) return;
            seen.add(course.id);
            options.push({ course, depth });
            for (const child of childrenOf.get(course.id) ?? []) visit(child, depth + 1);
        };
        for (const course of tops) visit(course, 0);
        return options;
    }, [courses, syllabus?.courseIds]);
}

/** Every course id under `ids` in the option tree (the ids included). */
function withDescendants(ids: Set<string>, options: Array<CourseOption>): Set<string> {
    const covered = new Set<string>();
    let coveringDepth: null | number = null;
    for (const { course, depth } of options) {
        if (coveringDepth !== null && depth <= coveringDepth) coveringDepth = null;
        if (coveringDepth === null && ids.has(course.id)) coveringDepth = depth;
        if (coveringDepth !== null) covered.add(course.id);
    }
    return covered;
}

function CoursesPicker({
    event,
    eventId,
    groupSize,
    options,
}: {
    event: GanttEvent;
    eventId: GanttEventId;
    groupSize: number;
    options: Array<CourseOption>;
})
{
    const { enqueueSnackbar } = useSnackbar();
    const { updateEvent } = useModuleEventActions();
    const current = useMemo(() => new Set(event.courseIds ?? []), [event.courseIds]);
    const [selected, setSelected] = useState<Set<string>>(current);
    const [isSaving, setIsSaving] = useState(false);
    const covered = useMemo(() => withDescendants(selected, options), [selected, options]);

    const toggle = useCallback((id: string) => {
        setSelected((previous) => {
            const next = new Set(previous);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    if (groupSize > 1) {
        return (
            <Alert severity="info">
                המופע מפוצל לשאפלים. כדי לשייך אותו למסלולים בלבד, בטלו קודם את
                הקבוצה במצב &quot;שאפלים&quot;.
            </Alert>
        );
    }
    if (options.length === 0) {
        return (
            <Typography color="text.secondary" variant="body2">
                אין מסלולים לבחירה. שייכו את המקצוע למסלולים בחלון המקצוע.
            </Typography>
        );
    }

    // Covering every option is the whole syllabus — that's the "all" mode.
    const topIds = options.filter((option) => option.depth === 0).map((option) => option.course.id);
    const coversAll = topIds.every((id) => covered.has(id));
    const isDirty =
        selected.size !== current.size || [...selected].some((id) => !current.has(id));

    const apply = () => {
        setIsSaving(true);
        updateEvent(eventId, { courseIds: [...selected], shuffles: [] })
            .catch((error) =>
                enqueueApiErrorSnackbar(enqueueSnackbar, "שיוך המופע למסלולים נכשל!", error),
            )
            .finally(() => setIsSaving(false));
    };

    return (
        <Stack spacing={1.5}>
            <Stack>
                {options.map(({ course, depth }) => {
                    const inherited = covered.has(course.id) && !selected.has(course.id);
                    return (
                        <FormControlLabel
                            control={
                                <Checkbox
                                    checked={covered.has(course.id)}
                                    disabled={inherited}
                                    onChange={() => toggle(course.id)}
                                    size="small"
                                />
                            }
                            key={course.id}
                            label={course.name}
                            sx={{ marginInlineStart: depth * 3 }}
                        />
                    );
                })}
            </Stack>
            <Stack alignItems="center" direction="row" spacing={1}>
                <Button
                    disabled={!isDirty || isSaving || selected.size === 0 || coversAll}
                    onClick={apply}
                    variant="contained"
                >
                    שיוך למסלולים שנבחרו
                </Button>
                {coversAll ? (
                    <Typography color="text.secondary" variant="caption">
                        כל המסלולים נבחרו — זה המופע לכל המקצוע.
                    </Typography>
                ) : null}
            </Stack>
        </Stack>
    );
}

function WholeSyllabus({
    event,
    eventId,
    groupSize,
    moduleId,
}: {
    event: GanttEvent;
    eventId: GanttEventId;
    groupSize: number;
    moduleId: GanttModuleId;
})
{
    const { enqueueSnackbar } = useSnackbar();
    const { applyEventShuffleGroup, updateEvent } = useModuleEventActions();
    const [isSaving, setIsSaving] = useState(false);
    const current = getEventAudienceMode(event);
    const consequence = current === "shuffles"
        ? describeGroupChange(new Set(event.shuffles ?? []), new Set(), groupSize)
        : null;

    const apply = () => {
        setIsSaving(true);
        const dissolve = current === "shuffles" && event.groupId
            ? applyEventShuffleGroup(eventId, moduleId, [])
            : Promise.resolve();
        dissolve
            .then(() => updateEvent(eventId, { courseIds: [], shuffles: [] }))
            .catch((error) =>
                enqueueApiErrorSnackbar(enqueueSnackbar, "עדכון המופע נכשל!", error),
            )
            .finally(() => setIsSaving(false));
    };

    return (
        <Stack spacing={1.5}>
            <Typography color="text.secondary" variant="body2">
                כל חניכי המקצוע משתתפים במופע, בכל השאפלים ובכל המסלולים של המקצוע.
            </Typography>
            {current !== "all" ? (
                <Stack alignItems="center" direction="row" spacing={1}>
                    <Button disabled={isSaving} onClick={apply} variant="contained">
                        החלה לכל המקצוע
                    </Button>
                    {consequence ? (
                        <Typography color="text.secondary" variant="caption">
                            {consequence.text}
                        </Typography>
                    ) : null}
                </Stack>
            ) : null}
        </Stack>
    );
}

/**
 * Who an event is for: the whole syllabus, a split into
 * shuffles (one copy per shuffle, aligned in the same block), or only some of
 * the syllabus' courses — which need not align with the other courses, and
 * where shuffles no longer apply.
 */
export function EventAudienceField({
    event,
    eventId,
    moduleId,
    syllabus,
}: {
    event: GanttEvent;
    eventId: GanttEventId;
    moduleId: GanttModuleId;
    syllabus: GanttSyllabus | null | undefined;
})
{
    const members = useShuffleGroupMembers(event, moduleId);
    const courseOptions = useCourseOptions(syllabus);
    const [mode, setMode] = useState<EventAudienceMode>(() => getEventAudienceMode(event));

    return (
        <Stack spacing={1.5}>
            <ToggleButtonGroup
                exclusive
                fullWidth
                onChange={(_, next: EventAudienceMode | null) => next && setMode(next)}
                size="small"
                value={mode}
            >
                <ToggleButton value="all">כל המקצוע</ToggleButton>
                <ToggleButton value="shuffles">שאפלים</ToggleButton>
                <ToggleButton value="courses">מסלולים</ToggleButton>
            </ToggleButtonGroup>

            <Box>
                {mode === "all" ? (
                    <WholeSyllabus
                        event={event}
                        eventId={eventId}
                        groupSize={members.length}
                        moduleId={moduleId}
                    />
                ) : null}
                {mode === "shuffles" ? (
                    <Stack spacing={1.5}>
                        {getEventAudienceMode(event) === "courses" ? (
                            <Alert severity="warning">
                                המופע משויך כרגע למסלולים. פיצול לשאפלים יבטל את השיוך.
                            </Alert>
                        ) : null}
                        <EventShuffleGroupField
                            event={event}
                            eventId={eventId}
                            moduleId={moduleId}
                            shuffleDescriptions={syllabus?.shuffleDescriptions}
                            shuffleOptions={syllabus?.shuffles ?? []}
                            syllabusId={syllabus?.id ?? null}
                        />
                    </Stack>
                ) : null}
                {mode === "courses" ? (
                    <Stack spacing={1.5}>
                        <Alert severity="info">
                            רק חניכי המסלולים שנבחרו משתתפים. המופע לא חייב להיות
                            מיושר עם המסלולים האחרים, והשאפלים לא חלים עליו.
                        </Alert>
                        <CoursesPicker
                            event={event}
                            eventId={eventId}
                            groupSize={members.length}
                            key={(event.courseIds ?? []).join("|")}
                            options={courseOptions}
                        />
                    </Stack>
                ) : null}
            </Box>
        </Stack>
    );
}
