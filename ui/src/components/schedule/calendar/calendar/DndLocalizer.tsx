/* eslint-disable import/order */
"use client";
import moment from "moment";
// @ts-ignore This import is broken
import "moment/locale/he"; // Import Hebrew locale
import { Calendar, momentLocalizer } from "react-big-calendar";

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
export { moment as calendarMoment };
export const localizer = momentLocalizer(moment);
export { DnDCalendar };
