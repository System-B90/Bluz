import { Period } from "@/components/schedule/types/event";
import dayjs from "dayjs";

export function dateFixup(period: Partial<Period>): Partial<Period>;
export function dateFixup(period: Period): Period;
export function dateFixup(period: Partial<Period>): Partial<Period>
{
    if (typeof window === 'undefined')
    {
        period.endTime = new Date(period.endTime as unknown as string);
        period.startTime = new Date(period.startTime as unknown as string);
    }
    else
    {
        period.endTime = dayjs(period.endTime);
        period.startTime = dayjs(period.startTime);
    }
    return period;
}
