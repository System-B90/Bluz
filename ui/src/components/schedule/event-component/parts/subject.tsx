import Typography, { TypographyProps } from "@mui/material/Typography";
import Link from "next/link";
import { useMemo } from "react";

import { getHiveBaseUrl } from "@/api-shared/common";
import { ModuleLike } from "@/api-shared/types/module";
import { SubjectLike } from "@/api-shared/types/subject";
import { useHiveLessons } from "@/components/base/HiveLessonsProvider";
import { useHiveModules } from "@/components/base/HiveModulesProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";

export function SubjectComponent({
    subjectId,
    ...props
}: { subjectId: SubjectLike } & TypographyProps) {
    const { getSubject } = useHiveSubjects();
    const subject = useMemo(
        () => getSubject(subjectId),
        [subjectId, getSubject],
    );

    return (
        <Link
            className="hover:underline"
            href={`${getHiveBaseUrl()}/course/${subject?.id}`}
        >
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

    return (
        <Link
            className="hover:underline"
            href={`${getHiveBaseUrl()}/course/${hiveModule?.parent_subject}/${hiveModule?.id}`}
        >
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
