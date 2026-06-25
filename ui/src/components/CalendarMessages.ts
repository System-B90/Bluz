import { Messages } from "react-big-calendar";

import { Event } from "@/components/schedule/types/event";

const CALENDAR_MESSAGES: Messages<Event> = {
    date: "תאריך",
    time: "זמן",
    event: "מופע",
    allDay: "",
    week: "שבוע",
    work_week: "שבוע עבודה",
    day: "יום",
    month: "חודש",
    previous: "קודם",
    next: "הבא",
    yesterday: "אתמול",
    tomorrow: "מחר",
    today: "היום",
    agenda: "יומן",
    noEventsInRange: "לא נמצאו מופעים בטווח זה.",
    showMore: undefined,
};

export { CALENDAR_MESSAGES };
