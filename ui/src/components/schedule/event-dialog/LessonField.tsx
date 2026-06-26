import FormControl, { FormControlProps } from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import { useMemo } from "react";

import { useHiveLessons } from "@/components/base/HiveLessonsProvider";
import { Event, eventHasSubject } from "@/components/schedule/types/event";

type LessonFieldProps = {
    event?: Partial<Event>;
    onEventChange: (updates: Partial<Event>) => void;
};

export function LessonField({
    event,
    onEventChange,
    ...props
}: LessonFieldProps & FormControlProps)
{
    const { getLessonsOfModule } = useHiveLessons();
    const lessons = useMemo(
        () => (event?.hiveModule ? getLessonsOfModule(Number(event.hiveModule)) : []),
        [ event, getLessonsOfModule ],
    );

    const lessonMenuItems = lessons.map((lesson) => (
        <MenuItem key={ lesson.id } value={ lesson.id }>
            { lesson.name }
        </MenuItem>
    ));

    return (
        <FormControl
            disabled={
                (event?.type ? !eventHasSubject(event?.type) : false) ||
                !event?.hiveModule ||
                lessons.length === 0
            }
            fullWidth={ false }
            { ...props }
        >
            <InputLabel>שיעור</InputLabel>
            <Select
                label="שיעור"
                onChange={ (e) => onEventChange({ hiveLesson: e.target.value ? Number(e.target.value) : null }) }
                value={ event?.hiveLesson ?? "" }
            >
                <MenuItem value="">
                    <em>ללא שיעור</em>
                </MenuItem>
                { lessonMenuItems }
            </Select>
        </FormControl>
    );
}
