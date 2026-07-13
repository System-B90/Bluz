"use client";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { useMemo, useState } from "react";

import { useHiveLessons } from "@/components/base/HiveLessonsProvider";
import { HiveModuleSelect } from "@/components/base/HiveModuleSelect";
import { useHiveModules } from "@/components/base/HiveModulesProvider";
import { HiveSubjectSelect } from "@/components/base/HiveSubjectSelect";

export function HiveModulesView({
    hiveModules,
    onRemove,
}: {
    hiveModules: Array<number>;
    /** When provided, each chip becomes deletable and unlinks that module. */
    onRemove?: (id: number) => void;
}) {
    const { getModule } = useHiveModules();

    if (hiveModules.length === 0) {
        return (
            <Typography color="text.secondary" variant="body2">
                אין מערכים מקושרים
            </Typography>
        );
    }

    return (
        <Box>
            <Typography
                sx={{ mb: 1 }}
                variant="subtitle2"
            >
                מערכים מקושרים בהייב
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
                {hiveModules.map((id) => {
                    const mod = getModule(id);
                    return (
                        <Chip
                            key={id}
                            label={mod?.name ?? `#${id}`}
                            onDelete={onRemove ? () => onRemove(id) : undefined}
                            size="small"
                            variant="outlined"
                        />
                    );
                })}
            </Stack>
        </Box>
    );
}

/**
 * Subject → Module picker that links a Hive module to the Gantt module.
 * Selecting a module appends its id to {@link hiveModules} (deduplicated).
 */
export function HiveModuleLinker({
    hiveModules,
    onChange,
}: {
    hiveModules: Array<number>;
    onChange: (ids: Array<number>) => void;
}) {
    const [subject, setSubject] = useState<null | string>(null);

    const handlePick = (moduleId: null | string) => {
        if (!moduleId) return;
        const id = Number(moduleId);
        if (!hiveModules.includes(id)) {
            onChange([...hiveModules, id]);
        }
    };

    return (
        <Box>
            <Typography sx={{ mb: 1 }} variant="subtitle2">
                קישור מערך מהייב
            </Typography>
            <Stack direction="row" spacing={1}>
                <HiveSubjectSelect
                    allowEmpty
                    onChange={setSubject}
                    size="small"
                    sx={{ flex: 1 }}
                    value={subject}
                />
                <HiveModuleSelect
                    disabled={subject === null}
                    onChange={handlePick}
                    size="small"
                    subject={subject ?? undefined}
                    sx={{ flex: 1 }}
                    value={null}
                />
            </Stack>
        </Box>
    );
}

export function HiveLessonsView({
    hiveModules,
}: {
    hiveModules: Array<number>;
}) {
    const { getLessonsOfModule } = useHiveLessons();
    const lessons = useMemo(() => {
        return hiveModules.flatMap((id) => getLessonsOfModule(id));
    }, [hiveModules, getLessonsOfModule]);

    if (lessons.length === 0) {
        return null;
    }

    return (
        <Box>
            <Typography
                sx={{ mb: 1 }}
                variant="subtitle2"
            >
                שיעורים מקושרים בהייב
            </Typography>
            <Stack direction="row" flexWrap="wrap" gap={1}>
                {lessons.map((lesson) => (
                    <Chip
                        color="primary"
                        key={lesson.id}
                        label={lesson.name}
                        size="small"
                        variant="outlined"
                    />
                ))}
            </Stack>
        </Box>
    );
}
