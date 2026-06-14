import { Event } from "@/components/schedule/types/event";

export type EventFieldProps = {
    event?: Partial<Event>;
    onBlurCallback: (event: Partial<Event>) => void;
};
