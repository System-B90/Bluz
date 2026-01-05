import { Period } from "@/components/schedule/types/event";

export interface PeriodDataUpdateMessage
{
    periods: Record<string, Period>;
}
interface PeriodRemovedMessage
{
    action: 'removed';
    periodId: string;
}

interface PeriodAddedMessage
{
    action: 'added';
    periodId: string;
    newData: Period;
}

export type PeriodAddedOrRemovedMessage = PeriodRemovedMessage | PeriodAddedMessage;