import Typography, { TypographyProps } from "@mui/material/Typography";
import Link from "next/link";
import { useMemo } from "react";

import { hiveModuleUrl, hiveSubjectUrl } from "@/api-shared/hive-links";
import { HiveLessonId } from "@/api-shared/types/hive";
import { ModuleLike } from "@/api-shared/types/module";
import { SubjectLike } from "@/api-shared/types/subject";
import { useHiveLessons } from "@/components/base/HiveLessonsProvider";
import { useHiveModules } from "@/components/base/HiveModulesProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import { useActiveIterationHiveUrl } from "@/components/base/IterationProvider";

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

    // href="#" as a placeholder link jumps the page to the top on click —
    // fall back to plain (non-link) text when the real URL isn't resolved.
    if (!href) {
        return <Typography {...props}>{subject?.name}</Typography>;
    }

    return (
        <Link className="hover:underline" href={href}>
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

    if (!href) {
        return <Typography {...props}>{hiveModule?.name}</Typography>;
    }

    return (
        <Link className="hover:underline" href={href}>
            <Typography {...props}>{hiveModule?.name}</Typography>
        </Link>
    );
}

export function LessonComponent({
    lessonId,
    ...props
}: { lessonId: HiveLessonId } & TypographyProps) {
    const { getLesson } = useHiveLessons();
    const lesson = useMemo(
        () => getLesson(lessonId),
        [lessonId, getLesson],
    );

    return (
        <Typography {...props}>{lesson?.name ?? `#${lessonId}`}</Typography>
    );
}
