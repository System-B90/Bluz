import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import { useMemo } from "react";

import { GanttEvent } from "@/api-shared/types/gantt/models/event";
import { useHiveLessons } from "@/components/base/HiveLessonsProvider";
import { useHiveModules } from "@/components/base/HiveModulesProvider";
import { useHiveSubjects } from "@/components/base/HiveSubjectsProvider";

export type EventHiveLinkageFieldsProps = {
    event: GanttEvent;
    commit: (updates: Partial<GanttEvent>) => void;
};

export function EventHiveLinkageFields({
    event,
    commit,
}: EventHiveLinkageFieldsProps)
{
    const { subjects } = useHiveSubjects();
    const { getModulesOfSubject } = useHiveModules();
    const { getLessonsOfModule } = useHiveLessons();

    const modules = useMemo(
        () =>
            event.hiveSubjectId !== null
                ? getModulesOfSubject(event.hiveSubjectId)
                : [],
        [ event.hiveSubjectId, getModulesOfSubject ],
    );

    const lessons = useMemo(
        () =>
            event.hiveModuleId !== null
                ? getLessonsOfModule(event.hiveModuleId)
                : [],
        [ event.hiveModuleId, getLessonsOfModule ],
    );

    return (
        <Stack direction="row" spacing={ 2 }>
            <FormControl size="small" sx={ { flex: 1, minWidth: "10rem" } }>
                <InputLabel>מקצוע</InputLabel>
                <Select
                    label="מקצוע"
                    onChange={ (e: SelectChangeEvent<"" | number>) =>
                        commit({
                            hiveSubjectId: e.target.value === "" ? null : Number(e.target.value),
                            hiveModuleId: null,
                            hiveLessonId: null,
                        }) }
                    value={ event.hiveSubjectId ?? "" }
                >
                    <MenuItem value="">
                        <em>ללא מקצוע</em>
                    </MenuItem>
                    { subjects.map((subject) => (
                        <MenuItem key={ subject.id } value={ subject.id }>
                            { subject.name }
                        </MenuItem>
                    )) }
                </Select>
            </FormControl>

            <FormControl
                disabled={ event.hiveSubjectId === null || modules.length === 0 }
                size="small"
                sx={ { flex: 1, minWidth: "10rem" } }
            >
                <InputLabel>מודול</InputLabel>
                <Select
                    label="מודול"
                    onChange={ (e: SelectChangeEvent<"" | number>) =>
                        commit({
                            hiveModuleId: e.target.value === "" ? null : Number(e.target.value),
                            hiveLessonId: null,
                        }) }
                    value={ event.hiveModuleId ?? "" }
                >
                    <MenuItem value="">
                        <em>ללא מודול</em>
                    </MenuItem>
                    { modules.map((module) => (
                        <MenuItem key={ module.id } value={ Number(module.id) }>
                            { module.name }
                        </MenuItem>
                    )) }
                </Select>
            </FormControl>

            <FormControl
                disabled={ event.hiveModuleId === null || lessons.length === 0 }
                size="small"
                sx={ { flex: 1, minWidth: "10rem" } }
            >
                <InputLabel>שיעור</InputLabel>
                <Select
                    label="שיעור"
                    onChange={ (e: SelectChangeEvent<"" | number>) =>
                        commit({
                            hiveLessonId: e.target.value === "" ? null : Number(e.target.value),
                        }) }
                    value={ event.hiveLessonId ?? "" }
                >
                    <MenuItem value="">
                        <em>ללא שיעור</em>
                    </MenuItem>
                    { lessons.map((lesson) => (
                        <MenuItem key={ lesson.id } value={ lesson.id }>
                            { lesson.name }
                        </MenuItem>
                    )) }
                </Select>
            </FormControl>
        </Stack>
    );
}
