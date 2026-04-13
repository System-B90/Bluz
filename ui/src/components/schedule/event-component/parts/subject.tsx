import { getHiveBaseUrl } from "@/api-shared/common";
import { useHiveModules } from "@/components/base/HiveModulesProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";
import { ModuleLike } from "@/components/schedule/types/module";
import { SubjectLike } from "@/components/schedule/types/subject";
import { Typography, TypographyProps } from "@mui/material";
import Link from "next/link";
import { useMemo } from "react";



export default function SubjectComponent({ subjectId, ...props }: { subjectId: SubjectLike; } & TypographyProps)
{
    const { getSubject } = useHiveSubjects();
    const subject = useMemo(() => getSubject(subjectId), [ subjectId, getSubject, ]);

    return (
        <Link href={ `${getHiveBaseUrl()}/course/${subject?.id}` } className="hover:underline">
            <Typography { ...props }>{ subject?.name }</Typography>
        </Link>
    );
}

export function ModuleComponent({ moduleId, ...props }: { moduleId: ModuleLike; } & TypographyProps)
{
    const { getModule } = useHiveModules();
    const hiveModule = useMemo(() => getModule(moduleId), [ moduleId, getModule, ]);

    return (
        <Link href={ `${getHiveBaseUrl()}/course/${hiveModule?.parent_subject}/${hiveModule?.id}` } className="hover:underline">
            <Typography { ...props }>{ hiveModule?.name }</Typography>
        </Link>
    );
}
