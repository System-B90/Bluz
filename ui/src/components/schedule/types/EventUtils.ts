import { Dayjs } from "dayjs";

import { Event } from "@/components/schedule/types/event";

export function deepCopyEvent(event: Event): Event {
  const cpy = {
    ...event,
  };

  cpy.courses = [...event.courses];
  cpy.rooms = [...event.rooms];
  cpy.instructors = [...event.instructors];
  cpy.lecturers = [...(event.lecturers ?? [])];
  cpy.tags = [...event.tags];

  return cpy;
}

function arraysEqual<T>(a: T[] | undefined, b: T[] | undefined): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.length !== b.length) return false;

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }

  return true;
}

function isDateLike(
  value: any | Date | Dayjs,
): value is { valueOf: () => number } | Date {
  if (value instanceof Date) {
    return true;
  }

  // Check Dayjs fields
  if (typeof value !== "object") {
    return false;
  }
  if (typeof value["toDate"] !== "function") {
    return false;
  }
  if (typeof value["hour"] !== "function") {
    return false;
  }
  if (typeof value["month"] !== "function") {
    return false;
  }
  if (typeof value["daysInMonth"] !== "function") {
    return false;
  }

  return true;
}

export function areValuesEqual(a: any, b: any): boolean {
  if (a === b) return true;

  if (a == null || b == null) {
    return a === b;
  }

  // Handle Date / Dayjs
  if (isDateLike(a) && isDateLike(b)) {
    return a.valueOf() === b.valueOf();
  }

  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    return arraysEqual(a, b);
  }

  // Handle objects (including extra dynamic properties)
  if (typeof a === "object" && typeof b === "object") {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!areValuesEqual(a[key], b[key])) return false;
    }

    return true;
  }

  return false;
}

export function areEventsEqual(event1: Event, event2: Event): boolean {
  return areValuesEqual(event1, event2);
}
