import { Messages } from "react-big-calendar";

// Purely textual: nothing here depends on what the calendar is rendering, so
// the item type stays open rather than pinned to a concrete event shape.
const CALENDAR_MESSAGES: Messages<object> = {
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
