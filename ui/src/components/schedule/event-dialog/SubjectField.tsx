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
                onEventChange({ subject: id ? Number(id) : undefined })
            }
            value={event?.subject != null ? String(event.subject) : null}
            {...props}
        />
    );
}
