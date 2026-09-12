 
"use client";
import moment from "moment";
// @ts-ignore This import is broken
import "moment/locale/he";
import { Calendar, momentLocalizer } from "react-big-calendar";

// DO NOT SORT IMPORTS - they are ordered for a reason!

import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/sass/styles.scss";
// Must be after! Reuses the staff calendar's theme so the student view
// matches the app instead of react-big-calendar's default palette.
import "@/style/calendar.css";

// No drag-and-drop addon here on purpose: pulling it in would add staff-only
// editing code to the read-only student bundle for no reason (see the bundle
// isolation note in StudentDayBoard.tsx, #656).
moment.locale("he");
export const localizer = momentLocalizer(moment);
export { Calendar };
