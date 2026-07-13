import Stack from "@mui/material/Stack";

import { GanttEvent } from "@/api-shared/types/gantt/models/event";
import { HiveLessonSelect } from "@/components/base/HiveLessonSelect";
import { HiveModuleSelect } from "@/components/base/HiveModuleSelect";
import { HiveSubjectSelect } from "@/components/base/HiveSubjectSelect";

export type EventHiveLinkageFieldsProps = {
    event: GanttEvent;
    commit: (updates: Partial<GanttEvent>) => void;
};

const fieldSx = { flex: 1, minWidth: "10rem" };

export function EventHiveLinkageFields({
    event,
    commit,
}: EventHiveLinkageFieldsProps) {
    return (
        <Stack direction="row" spacing={2}>
            <HiveSubjectSelect
                allowEmpty
                onChange={(id) =>
                    commit({
                        hiveSubjectId: id ? Number(id) : null,
                        hiveModuleId: null,
                        hiveLessonId: null,
                    })
                }
                size="small"
                sx={fieldSx}
                value={
                    event.hiveSubjectId !== null
                        ? String(event.hiveSubjectId)
                        : null
                }
            />

            <HiveModuleSelect
                allowEmpty
                disabled={event.hiveSubjectId === null}
                label="מודול"
                onChange={(id) =>
                    commit({
                        hiveModuleId: id ? Number(id) : null,
                        hiveLessonId: null,
                    })
                }
                size="small"
                subject={event.hiveSubjectId ?? undefined}
                sx={fieldSx}
                value={
                    event.hiveModuleId !== null
                        ? String(event.hiveModuleId)
                        : null
                }
            />

            <HiveLessonSelect
                allowEmpty
                disabled={event.hiveModuleId === null}
                module={event.hiveModuleId}
                onChange={(id) => commit({ hiveLessonId: id })}
                size="small"
                sx={fieldSx}
                value={event.hiveLessonId}
            />
        </Stack>
    );
}
