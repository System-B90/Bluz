"use client";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import FormControl from "@mui/material/FormControl";
import IconButton from "@mui/material/IconButton";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { useEffect, useId, useMemo, useState } from "react";

import { apiGetClasses, apiGetQueues } from "@/api-client/hive";
import { hiveClassUrl, hiveModuleUrl } from "@/api-shared/hive-links";
import { CourseId } from "@/api-shared/types/course";
import { Class, Queue } from "@/api-shared/types/hive";
import { useCourses } from "@/components/base/CoursesProvider";
import { useHiveLessons } from "@/components/base/HiveLessonsProvider";
import { useActiveIterationHiveUrl } from "@/components/base/IterationProvider";
import { Event, eventHasSubject } from "@/components/schedule/types/event";

type HiveQueueMappingProps = {
    event: Partial<Event>;
    onUpdate: (updates: Partial<Event>) => void;
};

/**
 * The Hive side of an event, stated outright rather than left to be inferred:
 * which lesson backs it, and which queue each shuffle's students will be put
 * on when the event starts. Every row also links into Hive itself, so a staff
 * member can check the real thing in one click.
 */
export function HiveQueueMapping({ event, onUpdate }: HiveQueueMappingProps) {
    const labelIdPrefix = useId();
    const { getCourse } = useCourses();
    const hiveUrl = useActiveIterationHiveUrl();
    const { getLesson } = useHiveLessons();
    // Keyed by module so a stale module's queues can never be offered while a
    // new module's are still loading — the picker either shows this module's
    // queues or nothing.
    const [queuesByModule, setQueuesByModule] = useState<
        Record<number, Array<Queue>>
    >({});
    const [hiveClasses, setHiveClasses] = useState<Array<Class>>([]);
    // Collapsed by default: the Hive side is a check, not the main edit.
    const [expanded, setExpanded] = useState(false);

    const moduleId = event.hiveModule ?? null;
    const applies =
        Boolean(event.type && eventHasSubject(event.type)) && !event.fake;
    const courseIds = useMemo(() => event.courses ?? [], [event.courses]);
    // Declared above the `applies` early return: hooks cannot be conditional.
    const classIdByName = useMemo(
        () => new Map(hiveClasses.map((c) => [c.name, c.id])),
        [hiveClasses],
    );

    useEffect(() => {
        if (!applies || !moduleId) return;

        let cancelled = false;
        apiGetQueues({ module: moduleId })
            .then((fetched) => {
                if (cancelled) return;
                setQueuesByModule((previous) => ({
                    ...previous,
                    [moduleId]: fetched,
                }));
            })
            .catch(() => {
                // A module id that this Hive does not know (ids are not
                // stable across iterations) answers 400. That is information
                // the editor needs in place, not a toast to dismiss.
                if (cancelled) return;
                setQueuesByModule((previous) => ({
                    ...previous,
                    [moduleId]: [],
                }));
            });

        return () => {
            cancelled = true;
        };
    }, [applies, moduleId]);

    useEffect(() => {
        if (!applies) return;

        // Same cancellation guard as the queues effect above (#621): toggling
        // a field off and on quickly can otherwise let an older response
        // overwrite a newer one, or set state after unmount.
        let cancelled = false;
        apiGetClasses()
            .then((fetched) => {
                if (cancelled) return;
                setHiveClasses(fetched);
            })
            .catch(() => {
                if (cancelled) return;
                setHiveClasses([]);
            });

        return () => {
            cancelled = true;
        };
    }, [applies]);

    if (!applies) return null;

    // No entry yet for the chosen module ⇒ its queues are still in flight.
    const loading =
        Boolean(moduleId) && queuesByModule[moduleId!] === undefined;
    const queues = (moduleId && queuesByModule[moduleId]) || [];
    const mapping = event.hiveQueues ?? {};
    // Queue id 0 is a legitimate id, so test for presence rather than
    // truthiness (#622).
    const mappedCount = courseIds.filter(
        (id) => mapping[id] !== undefined,
    ).length;
    const lesson = event.hiveLesson ? getLesson(event.hiveLesson) : undefined;
    const moduleLink = hiveModuleUrl(event.subject, moduleId, hiveUrl);

    const setQueueForCourse = (courseId: CourseId, queueId: "" | number) => {
        const next = { ...mapping };
        if (queueId === "") delete next[courseId];
        else next[courseId] = queueId;
        onUpdate({ hiveQueues: next });
    };

    return (
        <Paper sx={{ p: 2, width: "100%" }} variant="outlined">
            <Stack
                alignItems="center"
                direction="row"
                justifyContent="space-between"
                onClick={() => setExpanded((open) => !open)}
                spacing={1}
                sx={{ cursor: "pointer" }}
            >
                <Stack alignItems="center" direction="row" spacing={1}>
                    <IconButton
                        aria-expanded={expanded}
                        aria-label={expanded ? "כיווץ" : "הרחבה"}
                        size="small"
                        sx={{
                            transform: expanded
                                ? "rotate(180deg)"
                                : "rotate(0deg)",
                            transition: "transform 150ms",
                        }}
                    >
                        <ExpandMoreIcon fontSize="small" />
                    </IconButton>
                    <Typography variant="subtitle2">
                        תורים בהייב לפי שיבוץ
                    </Typography>
                    {!expanded && moduleId ? (
                        <Chip
                            color={mappedCount > 0 ? "success" : "warning"}
                            label={`${mappedCount}/${courseIds.length} תורים`}
                            size="small"
                            variant="outlined"
                        />
                    ) : null}
                </Stack>
                {moduleLink ? (
                    <Link
                        href={moduleLink}
                        onClick={(e) => e.stopPropagation()}
                        rel="noopener"
                        target="_blank"
                        underline="hover"
                        variant="body2"
                    >
                        פתיחת המודול בהייב
                        <OpenInNewIcon
                            fontSize="inherit"
                            sx={{ marginInlineStart: 0.5 }}
                        />
                    </Link>
                ) : null}
            </Stack>

            <Collapse in={expanded} unmountOnExit>
                <Box sx={{ mt: 1 }}>
                    <HiveLessonStatus
                        lessonName={lesson?.name}
                        mappedCount={mappedCount}
                        moduleId={moduleId}
                    />
                </Box>

                {moduleId && !loading && queues.length === 0 ? (
                    <Alert severity="warning" sx={{ mt: 1 }} variant="outlined">
                        לא נמצאו תורים למודול הזה בהייב — ייתכן שהמודול אינו
                        קיים בהייב הנוכחי, או שלא הוגדרו לו תורים.
                    </Alert>
                ) : null}

                {moduleId && courseIds.length === 0 ? (
                    <Alert severity="info" sx={{ mt: 1 }} variant="outlined">
                        בחרו מסלולים כדי לשייך להם תורים.
                    </Alert>
                ) : null}

                <Stack spacing={1} sx={{ mt: 1 }}>
                    {courseIds.map((courseId) => {
                        const course = getCourse(courseId);
                        const name = course?.name ?? courseId;
                        const hiveClassId = classIdByName.get(name);
                        const classLink = hiveClassUrl(hiveClassId, hiveUrl);

                        return (
                            <Stack
                                alignItems="center"
                                direction="row"
                                key={courseId}
                                spacing={1}
                            >
                                <Chip
                                    label={name}
                                    size="small"
                                    sx={{ minWidth: 110 }}
                                />

                                <FormControl
                                    disabled={!moduleId || loading}
                                    fullWidth
                                    size="small"
                                >
                                    <InputLabel
                                        id={`${labelIdPrefix}-${courseId}`}
                                    >
                                        תור
                                    </InputLabel>
                                    <Select<"" | number>
                                        label="תור"
                                        labelId={`${labelIdPrefix}-${courseId}`}
                                        onChange={(e) =>
                                            setQueueForCourse(
                                                courseId,
                                                // `|| ""` would collapse the
                                                // valid queue id 0 to "unset"
                                                // (#622).
                                                e.target.value === ""
                                                    ? ""
                                                    : Number(e.target.value),
                                            )
                                        }
                                        value={mapping[courseId] ?? ""}
                                    >
                                        <MenuItem value="">
                                            <em>ללא תור</em>
                                        </MenuItem>
                                        {queues.map((queue) => (
                                            <MenuItem
                                                key={queue.id}
                                                value={queue.id}
                                            >
                                                {queue.name}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>

                                {hiveClassId === undefined ? (
                                    <Tooltip title="אין בהייב קבוצת תלמידים בשם זה — לא ייפתח תור לשיבוץ הזה">
                                        <Chip
                                            color="warning"
                                            label="לא נמצא בהייב"
                                            size="small"
                                            variant="outlined"
                                        />
                                    </Tooltip>
                                ) : (
                                    <Tooltip title="פתיחת הקבוצה בהייב">
                                        <IconButton
                                            component="a"
                                            href={classLink ?? undefined}
                                            rel="noopener"
                                            size="small"
                                            target="_blank"
                                        >
                                            <OpenInNewIcon fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Stack>
                        );
                    })}
                </Stack>
            </Collapse>
        </Paper>
    );
}

/** One line that says exactly what Hive holds for this event right now. */
function HiveLessonStatus({
    lessonName,
    mappedCount,
    moduleId,
}: {
    lessonName?: string;
    mappedCount: number;
    moduleId: null | number;
}) {
    if (!moduleId) {
        return (
            <Alert severity="info" variant="outlined">
                בחרו מודול כדי לשייך תורים — בלי מודול לא ייווצר שיעור בהייב.
            </Alert>
        );
    }
    if (mappedCount === 0) {
        return (
            <Alert severity="warning" variant="outlined">
                {lessonName
                    ? `קיים שיעור בהייב ("${lessonName}"), אך ללא תורים — לא ייפתח תור לתלמידים.`
                    : "לא ייווצר שיעור בהייב — לא נבחרו תורים."}
            </Alert>
        );
    }
    return (
        <Alert severity="success" variant="outlined">
            {lessonName
                ? `שיעור בהייב: "${lessonName}" — ייפתח ל-${mappedCount} שיבוצים בתחילת המופע.`
                : `שיעור בהייב ייווצר בשמירה — ייפתח ל-${mappedCount} שיבוצים בתחילת המופע.`}
        </Alert>
    );
}
