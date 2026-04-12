import { Event } from "@/components/schedule/types/event";

export interface EventFieldProps
{
    event?: Partial<Event>;
    onBlurCallback: (event: Partial<Event>) => void;
}
