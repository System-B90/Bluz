import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import Box from "@mui/material/Box";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import { ReactElement, ReactNode, useMemo } from "react";

import {
    CapacityStatus,
    formatHours,
    formatHoursLabel,
    getCapacityStatus,
} from "@/components/gantt/curriculum-view/gantt-time-utils";
import {
    DayStudentLoad,
    PathDayLoad,
    StudentLoadIssue,
    StudentPath,
} from "@/components/gantt/curriculum-view/student-load";
import { useCurriculumState } from "@/components/gantt/state/context";

const STATUS_COLOR: Record<CapacityStatus, string> = {
    empty: "text.disabled",
    error: "error.main",
    ok: "primary.main",
    warning: "warning.main",
};

type PathGroup = { labels: Array<string>; load: PathDayLoad };

/** Paths whose day is made of exactly the same syllabus minutes share a row. */
function groupIdenticalPaths(
    load: DayStudentLoad,
    paths: Array<StudentPath>,
): Array<PathGroup> {
    const labelById = new Map(paths.map((path) => [path.id, path.label]));
    const groups = new Map<string, PathGroup>();
    for (const pathLoad of load.paths) {
        const key = pathLoad.bySyllabus
            .map((entry) => `${entry.syllabusId}:${entry.minutes}`)
            .join("|");
        const label = labelById.get(pathLoad.pathId) ?? "";
        const group = groups.get(key);
        if (group) group.labels.push(label);
        else groups.set(key, { labels: [label], load: pathLoad });
    }
    return [...groups.values()].sort((a, b) => b.load.minutes - a.load.minutes);
}

function Section({ title, children }: { title: string; children: ReactNode })
{
    return (
        <Box>
            <Typography color="text.secondary" sx={{ lineHeight: 1.6 }} variant="overline">
                {title}
            </Typography>
            <Stack spacing={1}>{children}</Stack>
        </Box>
    );
}

function PathRow({
    capacity,
    group,
    showLabel,
    syllabusTitle,
}: {
    capacity: number;
    group: PathGroup;
    showLabel: boolean;
    syllabusTitle: (syllabusId: string) => string;
})
{
    const { minutes, bySyllabus } = group.load;
    const status = getCapacityStatus(capacity, minutes);
    const fill = capacity > 0 ? Math.min(100, (minutes / capacity) * 100) : minutes > 0 ? 100 : 0;
    return (
        <Box data-testid="student-load-path">
            <Stack alignItems="baseline" direction="row" gap={1} justifyContent="space-between">
                {showLabel ? (
                    <Typography fontWeight={600} noWrap sx={{ minWidth: 0 }} variant="body2">
                        {group.labels.join(", ")}
                    </Typography>
                ) : <span />}
                <Typography color={STATUS_COLOR[status]} fontWeight={700} variant="body2">
                    {formatHoursLabel(minutes)}
                </Typography>
            </Stack>
            <Box sx={{ mt: 0.5, height: 6, borderRadius: 3, overflow: "hidden", bgcolor: "action.hover" }}>
                <Box sx={{ width: `${fill}%`, height: "100%", bgcolor: STATUS_COLOR[status] }} />
            </Box>
            {bySyllabus.length > 0 ? (
                <Typography color="text.secondary" sx={{ display: "block", mt: 0.5 }} variant="caption">
                    {bySyllabus
                        .map((entry) => `${syllabusTitle(entry.syllabusId)} ${formatHours(entry.minutes)}`)
                        .join(" · ")}
                </Typography>
            ) : null}
        </Box>
    );
}

/** One shuffle's time on the day, against the longest one. */
function ComparisonRow({ label, max, minutes }: { label: string; max: number; minutes: number })
{
    const short = max - minutes;
    return (
        <Box sx={{ display: "grid", gridTemplateColumns: "minmax(64px, auto) 1fr auto", alignItems: "center", columnGap: 1 }}>
            <Typography noWrap variant="body2">{label}</Typography>
            <Box sx={{ height: 6, borderRadius: 3, overflow: "hidden", bgcolor: "action.hover" }}>
                <Box
                    sx={{
                        width: `${max > 0 ? (minutes / max) * 100 : 0}%`,
                        height: "100%",
                        bgcolor: short > 0 ? "warning.main" : "text.secondary",
                    }}
                />
            </Box>
            <Typography sx={{ fontVariantNumeric: "tabular-nums", textAlign: "end" }} variant="body2">
                {formatHoursLabel(minutes)}
                {short > 0 ? (
                    <Box color="warning.main" component="span" fontWeight={700}>
                        {` (−${formatHours(short)})`}
                    </Box>
                ) : null}
            </Typography>
        </Box>
    );
}

/** A misaligned syllabus on the day, as its own block: what, why, and each shuffle's time. */
function IssueCard({
    issue,
    syllabusTitle,
}: {
    issue: StudentLoadIssue;
    syllabusTitle: (syllabusId: string) => string;
})
{
    const rows = Object.entries(issue.minutesByShuffle).map(([label, minutes]) => ({ label, minutes }));
    const max = Math.max(0, ...rows.map((row) => row.minutes));

    return (
        <Box
            data-testid="student-load-issue"
            sx={{
                p: 1,
                borderRadius: 1.5,
                border: 1,
                borderColor: "warning.main",
                bgcolor: (theme) => `rgba(${theme.vars.palette.warning.mainChannel} / 0.08)`,
            }}
        >
            <Stack alignItems="center" direction="row" gap={0.75}>
                <WarningAmberIcon color="warning" sx={{ fontSize: 18 }} />
                <Typography fontWeight={700} variant="subtitle2">{syllabusTitle(issue.syllabusId)}</Typography>
            </Stack>
            <Typography color="text.secondary" sx={{ display: "block", mt: 0.25, mb: 1 }} variant="caption">
                לשאפלים זמן שונה במקצוע ביום הזה — הם צריכים ללמוד אותו באותו בלוק.
            </Typography>
            <Stack spacing={0.75}>
                {rows.map((row) => (
                    <ComparisonRow key={row.label} label={row.label} max={max} minutes={row.minutes} />
                ))}
            </Stack>
        </Box>
    );
}

/** The card: the day's time, then each student path's, then what is wrong. */
export function StudentLoadCard({
    capacity,
    load,
    paths,
    title,
}: {
    capacity: number;
    load: DayStudentLoad | undefined;
    paths: Array<StudentPath>;
    title: string;
})
{
    const state = useCurriculumState();
    const syllabusTitle = (syllabusId: string) => state.syllabuses[syllabusId]?.title ?? "";
    const groups = useMemo(
        () => (load ? groupIdenticalPaths(load, paths) : []),
        [load, paths],
    );
    const minutes = load?.minutes ?? 0;
    const status = getCapacityStatus(capacity, minutes);

    return (
        <Stack data-testid="student-load-card" spacing={1.25} sx={{ minWidth: 280, maxWidth: 400 }}>
            <Box>
                <Typography fontWeight={700} variant="subtitle2">{title}</Typography>
                <Typography color="text.secondary" variant="caption">
                    <Box color={STATUS_COLOR[status]} component="span" fontWeight={700}>
                        {formatHoursLabel(minutes)}
                    </Box>
                    {` מתוך ${formatHoursLabel(capacity)} לחניך`}
                </Typography>
            </Box>
            {load && load.issues.length > 0 ? (
                <>
                    <Divider />
                    <Section title={`בעיות (${load.issues.length})`}>
                        {load.issues.map((issue) => (
                            <IssueCard
                                issue={issue}
                                key={issue.syllabusId}
                                syllabusTitle={syllabusTitle}
                            />
                        ))}
                    </Section>
                </>
            ) : null}
            {groups.length > 0 ? (
                <>
                    <Divider />
                    <Section title={groups.length > 1 ? `לפי מסלול (${paths.length})` : "לכל החניכים"}>
                        {groups.map((group) => (
                            <PathRow
                                capacity={capacity}
                                group={group}
                                key={group.labels.join("|")}
                                showLabel={groups.length > 1}
                                syllabusTitle={syllabusTitle}
                            />
                        ))}
                    </Section>
                </>
            ) : null}
        </Stack>
    );
}

/** Hover card over a day's scheduled-time figure, styled as a paper card. */
export function StudentLoadTooltip({
    children,
    ...card
}: {
    children: ReactElement;
    capacity: number;
    load: DayStudentLoad | undefined;
    paths: Array<StudentPath>;
    title: string;
})
{
    return (
        <Tooltip
            arrow
            enterDelay={150}
            placement="top"
            slotProps={{
                tooltip: {
                    sx: {
                        bgcolor: "background.paper",
                        color: "text.primary",
                        border: 1,
                        borderColor: "divider",
                        boxShadow: 8,
                        p: 1.25,
                        maxWidth: "none",
                    },
                },
                arrow: { sx: { color: "background.paper", "&::before": { border: 1, borderColor: "divider" } } },
            }}
            title={<StudentLoadCard {...card} />}
        >
            {children}
        </Tooltip>
    );
}
