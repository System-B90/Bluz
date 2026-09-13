import { FormControlProps } from "@mui/material/FormControl";

import { HiveSubjectSelect } from "@/components/base/HiveSubjectSelect";
import { Event, eventHasSubject } from "@/components/schedule/types/event";

type SubjectFieldProps = {
    event?: Partial<Event>;
    onEventChange: (updates: Partial<Event>) => void;
};

/** Event-dialog binding around the reusable {@link HiveSubjectSelect}. */
export function SubjectField({
    event,
    onEventChange,
    ...props
}: SubjectFieldProps & Omit<FormControlProps, "onChange">) {
    return (
        <HiveSubjectSelect
            disabled={event?.type ? !eventHasSubject(event?.type) : false}
            fullWidth={false}
            onChange={(id) =>
                // Modules and lessons belong to a subject, so a new subject
                // invalidates both — the same clearing ModuleField does for
                // the lesson (#619). Leaving them behind pointed the saved
                // event at a module from the previous subject.
                onEventChange({
                    hiveLesson: null,
                    hiveModule: undefined,
                    // Queue mappings are per module too (#653).
                    hiveQueues: {},
                    subject: id ? Number(id) : undefined,
                })
            }
            value={event?.subject != null ? String(event.subject) : null}
            {...props}
        />
    );
}
