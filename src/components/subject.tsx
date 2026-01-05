import { useHiveSubjects } from "@/components/base/hive-subjects-provider";
import { SubjectLike } from "@/components/schedule/types/subject";
import { Typography, TypographyProps } from "@mui/material";
import Link from "next/link";
import { useMemo } from "react";

export default function SubjectComponent({ subjectId, ...props }: { subjectId: SubjectLike; } & TypographyProps)
{
    const { subjects, getSubject } = useHiveSubjects();
    const subject = useMemo(() => getSubject(subjectId), [ subjects, subjectId ]);


    // TODO: link to subject page on Hive
    return (
        <Link href={ `/${subject?.id}` } className="hover:underline">
            <Typography { ...props }>{ subject?.name }</Typography>
        </Link>
    );
}
