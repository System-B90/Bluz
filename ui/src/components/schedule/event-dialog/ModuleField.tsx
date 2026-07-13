import { FormControlProps } from "@mui/material/FormControl";

import { HiveModuleSelect } from "@/components/base/HiveModuleSelect";
import { Event, eventHasSubject } from "@/components/schedule/types/event";

type ModuleFieldProps = {
    event?: Partial<Event>;
    onEventChange: (updates: Partial<Event>) => void;
};

/** Event-dialog binding around the reusable {@link HiveModuleSelect}. */
export function ModuleField({
    event,
    onEventChange,
    ...props
}: ModuleFieldProps & Omit<FormControlProps, "onChange">) {
    return (
        <HiveModuleSelect
            disabled={
                (event?.type ? !eventHasSubject(event?.type) : false) ||
                !event?.subject
            }
            fullWidth={false}
            onChange={(id) =>
                onEventChange({
                    hiveModule: id ? Number(id) : undefined,
                    hiveLesson: null,
                })
            }
            subject={event?.subject}
            value={event?.hiveModule != null ? String(event.hiveModule) : null}
            {...props}
        />
    );
}
