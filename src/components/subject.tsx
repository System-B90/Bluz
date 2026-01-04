import { useHiveSubjects } from "@/components/base/hive-subjects-provider";
import { Typography, TypographyProps } from "@mui/material";
import { useMemo } from "react";

export default function Subject({ subjectId, ...props }: { subjectId: string; } & TypographyProps)
{
    const { subjects } = useHiveSubjects();
    const subject = useMemo(() => subjects[ subjectId ], [ subjects, subjectId ]);

    return (
        <Typography { ...props }>{ subject?.name || subjectId }</Typography>
    );
}