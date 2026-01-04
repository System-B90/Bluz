import { Period } from "@/components/schedule/types/event";
import { Messages } from "react-big-calendar";

const CALENDAR_MESSAGES: Messages<Period> = {
    date: 'תאריך',
    time: 'זמן',
    event: 'מופע',
    allDay: 'כל היום',
    week: 'שבוע',
    work_week: 'שבוע עבודה',
    day: 'יום',
    month: 'חודש',
    previous: 'קודם',
    next: 'הבא',
    yesterday: 'אתמול',
    tomorrow: 'מחר',
    today: 'היום',
    agenda: 'יומן',
    noEventsInRange: 'לא נמצאו מופעים בטווח זה.',
    showMore: undefined,
};

export default CALENDAR_MESSAGES;