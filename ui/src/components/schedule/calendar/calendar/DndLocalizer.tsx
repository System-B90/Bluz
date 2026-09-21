/* eslint-disable import/order */
"use client";
import moment from "moment-timezone";
// @ts-ignore This import is broken
import "moment/locale/he"; // Import Hebrew locale
import { Calendar, momentLocalizer } from "react-big-calendar";

import { APP_TIMEZONE } from "@/api-shared/dayjs-setup";

// DO NOT SORT IMPORTS - they are ordered for a reason!

import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";

import "react-big-calendar/lib/addons/dragAndDrop/styles.css";
import "react-big-calendar/lib/css/react-big-calendar.css";
import "react-big-calendar/lib/sass/styles.scss";
// Must be after!
import "@/style/calendar.css";

import { EventSegment } from "@/components/schedule/calendar/split/segments";
import { Room } from "@/api-shared/types/room";

// The grid is driven by *segments*, not events: an event that jumps over
// breaks is drawn as one box per piece so react-big-calendar's own overlap
// layout stays correct. See `split/segments.ts`.
const DnDCalendar = withDragAndDrop<EventSegment, Room>(Calendar);

// Set the default locale to Hebrew
moment.locale("he");
// Pin rendering to the school's wall clock. Segments are computed in
// APP_TIMEZONE but cross into react-big-calendar as plain `Date`s, which the
// localizer would otherwise format in the device's timezone — same fix as
// student-view/StudentCalendarLocalizer.tsx.
moment.tz.setDefault(APP_TIMEZONE);
export { moment as calendarMoment };
export const localizer = momentLocalizer(moment);
export { DnDCalendar };
