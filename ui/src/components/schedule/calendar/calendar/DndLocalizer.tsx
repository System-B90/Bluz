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

import { Event } from "@/components/schedule/types/event";
import { Room } from "@/components/schedule/types/room";

const DnDCalendar = withDragAndDrop<Event, Room>(Calendar);

// Set the default locale to Hebrew
moment.locale("he");
export { moment as calendarMoment };
export const localizer = momentLocalizer(moment);
export { DnDCalendar };
