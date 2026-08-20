import Typography, { TypographyProps } from "@mui/material/Typography";
import Link from "next/link";
import { useMemo } from "react";

import { hiveModuleUrl, hiveSubjectUrl } from "@/api-shared/hive-links";
import { ModuleLike } from "@/api-shared/types/module";
import { SubjectLike } from "@/api-shared/types/subject";
import { useHiveLessons } from "@/components/base/HiveLessonsProvider";
import { useHiveModules } from "@/components/base/HiveModulesProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import { useIterationScope } from "@/components/base/IterationProvider";

/**
 * The Hive instance backing the currently viewed iteration — each iteration
 * runs against its own Hive, so a hard-coded/env-default base URL would link
 * a past iteration's events into the wrong instance.
 */
function useActiveIterationHiveUrl(): string | undefined {
    const { iterationId, currentIterationId, iterations } = useIterationScope();
    return useMemo(() => {
        const resolvedId = iterationId ?? currentIterationId;
        return iterations.find((it) => it.id === resolvedId)?.hiveUrl;
    }, [iterationId, currentIterationId, iterations]);
}

export function SubjectComponent({
    subjectId,
    ...props
}: { subjectId: SubjectLike } & TypographyProps) {
    const { getSubject } = useHiveSubjects();
    const subject = useMemo(
        () => getSubject(subjectId),
        [subjectId, getSubject],
    );
    const hiveUrl = useActiveIterationHiveUrl();
    const href = hiveSubjectUrl(
        subject?.id !== undefined ? Number(subject.id) : undefined,
        hiveUrl,
    );

    return (
        <Link className="hover:underline" href={href ?? "#"}>
            <Typography {...props}>{subject?.name}</Typography>
        </Link>
    );
}

export function ModuleComponent({
    moduleId,
    ...props
}: { moduleId: ModuleLike } & TypographyProps) {
    const { getModule } = useHiveModules();
    const hiveModule = useMemo(
        () => getModule(moduleId),
        [moduleId, getModule],
    );
    const hiveUrl = useActiveIterationHiveUrl();
    const href = hiveModuleUrl(
        hiveModule?.parent_subject !== undefined
            ? Number(hiveModule.parent_subject)
            : undefined,
        hiveModule?.id !== undefined ? Number(hiveModule.id) : undefined,
        hiveUrl,
    );

    return (
        <Link className="hover:underline" href={href ?? "#"}>
            <Typography {...props}>{hiveModule?.name}</Typography>
        </Link>
    );
}

export function LessonComponent({
    lessonId,
    ...props
}: { lessonId: number } & TypographyProps) {
    const { getLesson } = useHiveLessons();
    const lesson = useMemo(
        () => getLesson(lessonId),
        [lessonId, getLesson],
    );

    return (
        <Typography {...props}>{lesson?.name ?? `#${lessonId}`}</Typography>
    );
}
