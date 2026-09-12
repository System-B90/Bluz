 
"use client";
import moment from "moment-timezone";
// @ts-ignore This import is broken
import "moment/locale/he";
import { Calendar, momentLocalizer } from "react-big-calendar";

import { APP_TIMEZONE } from "@/api-shared/dayjs-setup";

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
/*
 * Pin rendering to the school's wall clock.
 *
 * The board already computes its grid bounds and every event instant in
 * APP_TIMEZONE, but those cross into react-big-calendar as plain `Date`s —
 * absolute instants — and `momentLocalizer` formats them in whatever timezone
 * the *device* is set to. A student on a phone in another timezone therefore
 * saw the whole day shifted (an 08:00 grid rendering as 06:00 on a UTC
 * device), which is exactly what `APP_TIMEZONE` exists to prevent: "all
 * calendar events are interpreted and displayed in Israel time regardless of
 * the viewer's browser timezone" (api-shared/dayjs-setup).
 *
 * Students are the exposed audience here — staff are on-site — so this pins
 * the student localizer. The staff calendar builds its own localizer in
 * components/schedule/calendar/calendar/DndLocalizer.tsx and carries the same
 * latent assumption.
 */
moment.tz.setDefault(APP_TIMEZONE);
export const localizer = momentLocalizer(moment);
export { Calendar };
