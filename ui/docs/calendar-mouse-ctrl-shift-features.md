# Calendar Ctrl/Shift Mouse Features — Status

Scope: `ui/src/components/schedule/calendar/calendar/UseCalendarHandlers.ts`,
`UseDragModifiers.ts`, `UsePrecisionDrag.ts`, `CalendarView.tsx`,
`event-component/base.tsx` (react-big-calendar drag/resize/click path).

All six behaviors below are implemented. Root cause of the original bugs (#575/#608/#475):
modifier state was read from plain `window` `keydown`/`keyup` listeners, sampled once at
drop time, with no drag-scoped state machine — so react-big-calendar's HTML5 drag backend
(which doesn't forward modifiers to `onEventDrop`) had nothing live to read, and a
mid-drag keydown could abort the drag outright. `UseDragModifiers.ts` replaces that: a
single drag-scoped tracker (`useDragModifiers`) that suppresses document-level propagation
of modifier keydowns while a drag is active (letting `Escape` through untouched), and
reports live duplicate/precision state via `mousemove` as well as `keydown`/`keyup`.

## 1. Ctrl+Drag — Duplicate Event

**Behavior** (#575, refined by #608):
- Holding `Ctrl` and dragging an event duplicates it on drop. The original stays in place;
  the dragged instance becomes a brand-new event at the drop target.
- `Escape` during the drag cancels the whole gesture, same as a plain drag.
- Precision (`Alt`) is a separate, independent modifier — see section 2.

**Implementation**: `CalendarView.tsx`'s `readModifiers().duplicate` (from
`useDragModifiers`, `CalendarView.tsx:358`) picks `"duplicate"` vs `"move"` as the
`GridInteraction` passed to `handleEventDrag` (`UseCalendarHandlers.ts`). The duplicate
branch there builds the new event via `copyableFields`, which strips `id`,
`locked`/`hidden`/`fake` (per-event display state), and the gantt-cut provenance fields
(`ganttEventId`/`ganttOccurrenceDate`/`ganttCurriculumId`) so the copy can't masquerade as
the source event. Locked events refuse the whole drag, duplicate included.

## 2. Alt+Drag — Precision (Fine) Move

**Behavior** (#475, modifier is `Alt` per #608 to stop colliding with duplicate):
- Holding `Alt` while dragging reduces pointer sensitivity to `PRECISION_FACTOR`
  (`UsePrecisionDrag.ts`) and snaps to the minute instead of the grid's 5-minute step.

**Implementation**: `CalendarView.tsx:359` wraps every drag delta through
`applyPrecision`, which calls `dampDragDelta(deltaMs, readModifiers().precise)`. Modifier
state comes from the same `useDragModifiers` tracker as duplicate, so both can be read
live and independently mid-drag.

## 3. Alt+Resize — Precision Resize

**Behavior**: holding the precision modifier while resizing an event applies the same
damped, minute-snapped adjustment as a precision move.

**Implementation**: the resize handler (`CalendarView.tsx:479`) runs its delta through
the same `applyPrecision` used for moves — no separate resize-specific path needed since
`GridInteraction` already distinguishes `"resize"` from `"move"`/`"duplicate"` for the
duplicate-only branch in `UseCalendarHandlers.ts`.

## 4. Dragging an Instructor Chip Drags the Event Underneath Too

Not in scope of this doc's fixes — tracked separately, unrelated to the drag-modifier
work above.

## 5. Middle-Click — Split Event

**Behavior** (#657):
- Middle-clicking an event splits it at the clicked time: the original is trimmed to end
  at the click point, and a new event is created from that point to the original's
  original end. Both keep the source event's fields (course, instructors, rooms, etc.).

**Implementation**: `event-component/base.tsx`'s `handleMouseDown` calls `splitHere` when
`pointer.button === MIDDLE_BUTTON`, and `pointer.preventDefault()` on middle-click stops
the browser's auto-scroll gesture from firing instead. `splitHere` resolves the clicked
instant to wall-clock time (`instantUnderPointer`) and calls `splitEventAt` from
`useSplitCalendar()`, which is `handleSplitEvent` in `UseCalendarHandlers.ts`.

`handleSplitEvent` measures durations in *working* time (`workingMsUpTo`/`workingMsOf`,
`api-shared/break-windows.ts`), so a split across a break window keeps both pieces'
lengths correct. A cut that would leave either piece under `MIN_SEGMENT_MINUTES` is
refused with a snackbar instead of silently producing a too-short event. Locked events
refuse the split entirely.

## 6. Shift+Click — Split Event

**Behavior** (#657, alternative gesture to middle-click, matching LuzApp):
- Shift+clicking an event splits it exactly like middle-click (section 5) — same
  trim/new-event/field-copy behavior, offered for devices/trackpads without a convenient
  middle button.

**Implementation**: `event-component/base.tsx`'s `handleClick` calls `splitHere` when
`pointer.shiftKey`, sharing the same `splitHere`/`splitEventAt`/`handleSplitEvent` path as
middle-click.

## Test Coverage

| Behavior | Test |
|---|---|
| Ctrl+Drag duplicate (drop-time save, locked-event refusal) | `tests/backend/calendar-handlers.test.tsx` — `useCalendarHandlers — duplicate` |
| Split trim/new-event, min-duration refusal, locked-event refusal | `tests/backend/calendar-handlers.test.tsx` — `useCalendarHandlers — split (#657)` |
| Drag-scoped modifier tracking: pre-drag state, live mid-drag changes, mousemove-driven updates, document-propagation suppression (Escape excepted), blur reset | `tests/backend/drag-modifiers.test.ts` |
| Middle-click / Shift+click split wiring (correct instant under pointer, non-split gestures ignored, locked-event refusal, middle-click autoscroll prevention) | `tests/backend/event-split-gestures.test.tsx` |
| `dampDragDelta` (damping factor, minute snap, precise-off passthrough) — shared by move and resize precision | `tests/backend/precision-drag.test.ts` |

The Alt-precision *resize* path in `CalendarView.tsx` has no dedicated test: it calls the
same `applyPrecision`/`dampDragDelta` already covered above, with no resize-specific
branching to exercise.

## Related Issues

| # | State | Title |
|---|-------|-------|
| 575 | closed | [Feature]: Event duplication using Ctrl+Drag |
| 608 | closed | Ctrl+drag duplicate lands at wrong offset (precision-drag damping conflicts with duplicate modifier) |
| 475 | closed | Ctrl+drag on schedule event should reduce mouse sensitivity for fine time adjustments |
| 628 | closed | Drag without Shift silently demotes a lecturer to instructor on target event (instructor-dnd, not this path) |
| 657 | open | Feature: split an event via middle-click / shift+click (like LuzApp) |
| 653 | open | Calendar page & components audit: data loss on Delete, Hive lesson duplication, filter empty-state failure, and grid edge cases |
