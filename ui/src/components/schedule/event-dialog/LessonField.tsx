import { FormControlProps } from "@mui/material/FormControl";

import { HiveLessonSelect } from "@/components/base/HiveLessonSelect";
import { Event, eventHasSubject } from "@/components/schedule/types/event";

type LessonFieldProps = {
    event?: Partial<Event>;
    onEventChange: (updates: Partial<Event>) => void;
};

/** Event-dialog binding around the reusable {@link HiveLessonSelect}. */
export function LessonField({
    event,
    onEventChange,
    ...props
}: LessonFieldProps & Omit<FormControlProps, "onChange">) {
    return (
        <HiveLessonSelect
            allowEmpty
            disabled={
                (event?.type ? !eventHasSubject(event?.type) : false) ||
                !event?.hiveModule
            }
            fullWidth={false}
            module={event?.hiveModule ?? null}
            onChange={(id) => onEventChange({ hiveLesson: id })}
            value={event?.hiveLesson ?? null}
            {...props}
        />
    );
}
