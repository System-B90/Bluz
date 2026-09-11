# Calendar Ctrl/Shift Mouse Features — Desired vs. Current

Scope: `ui/src/components/schedule/calendar/calendar/UseCalendarHandlers.ts`,
`UsePrecisionDrag.ts`, `CalendarView.tsx` (react-big-calendar drag/resize path).

## 1. Ctrl+Drag — Duplicate Event

**Desired** (#575, refined by #608):
- Holding `Ctrl` and dragging an event duplicates it. The original stays in place; the
  duplicate is what follows the pointer.
- The duplicate registers on the server only after it's dropped — not while still being
  dragged.
- `Escape` during the drag cancels the duplicate entirely (no copy created, nothing sent).
- Precision/fine-adjustment during a drag is a **separate** modifier (`Alt`, per #608's
  resolution) — quarter-speed movement snapped to the minute, independent of duplication.

**Current behavior (bug):**
- `ctrlHeldRef` (`UseCalendarHandlers.ts:57-76`) is only read once, at drop time
  (`handleEventDrag`, line 102), from a `keydown`/`keyup` listener on `window`. It has no
  effect on the drag while it's in progress — no duplicate preview, no live feedback.
- The only visible effect of holding `Ctrl` during a drag is the original event turning
  opaque — that's react-big-calendar's own default drag-source styling, unrelated to the
  Ctrl handling in this codebase. It happens whether or not Ctrl is held.
- **Pressing `Ctrl` mid-drag (after the drag already started) aborts the drag** instead of
  arming duplication: the dragged item is abandoned mid-air, the original is left opaque,
  and no drop / duplicate / move occurs. This is consistent with react-big-calendar's HTML5
  drag backend treating a modifier-key change mid-drag as an interruption, since nothing in
  this codebase intercepts or compensates for that.
- **Holding `Ctrl` before and through the whole drag** also does not duplicate — same
  opaque-original-only symptom, and on drop the event is duplicated with no live drag
  affordance (per the "only read at drop" issue above), so the interaction reads as broken
  even in the case where a duplicate technically gets created server-side.
- Net effect: Ctrl+Drag duplication as specified in #575 does not work as a live drag
  interaction today.

## 2. Ctrl/Alt+Drag — Precision (Fine) Move

**Desired** (#475, modifier moved to `Alt` by #608 to stop colliding with duplicate):
- Holding the precision modifier while dragging reduces pointer sensitivity to 25%
  (`PRECISION_FACTOR` in `UsePrecisionDrag.ts:6`) and snaps to the minute instead of the
  grid's 5-minute step, for fine time corrections.

**Current behavior (bug):**
- `usePrecisionDrag` (`UsePrecisionDrag.ts:37-64`) tracks `event.altKey` continuously via
  `keydown`/`keyup`/`mousemove` listeners, so precision itself is correctly modifier-driven
  in isolation.
- User-observed behavior is still that **Ctrl** (not Alt) is the key being tried, per report,
  and produces only the opaque-original styling — same symptom as case 1. Whether this is a
  stale expectation of the old Ctrl-based precision from #475 (before the #608 move to Alt),
  or the Alt path itself is silently non-functional in the live drag, needs to be confirmed
  against current `main`/branch state — but as experienced, no sensitivity reduction and no
  minute-level snap is visible during the drag, only the opacity change.

## 3. Ctrl+Resize — Precision Resize

**Desired:**
- Holding the precision modifier while resizing an event (dragging its top/bottom edge)
  should apply the same damped, minute-snapped adjustment as a precision move, so short
  resizes can be made accurately.

**Current behavior (bug):**
- No resize-specific precision handling exists. `handleEventDrag` in
  `UseCalendarHandlers.ts` takes an `interaction: "move" | "resize"` flag, but the
  duplicate branch is explicitly gated to `interaction === "move"` (line 102) and nothing
  applies `usePrecisionDrag`'s damping to a resize's start/end delta.
- Holding Ctrl (or Alt) while resizing produces the same opaque-original visual with no
  functional effect on the resize itself.

## 4. Dragging an Instructor Chip Drags the Event Underneath Too

**Desired:**
- Dragging an instructor chip off an event (to reassign/remove it, see instructor-dnd
  flow) should move only the chip. The event itself must stay put.

**Current behavior (bug):**
- Starting a chip drag also starts the calendar's own event drag underneath it. Both the
  chip and the whole event move together — awful UX, user can't tell which drag they're
  actually performing, and event position drifts as an unwanted side effect of what should
  be a chip-only reassignment.
- `InstructorDndProvider.tsx:268` wires `onDragStart={handleDragStart}` on the chip, but
  nothing stops the pointer/drag event from bubbling to the event component's own
  react-big-calendar drag handling (`event-component/base.tsx`) — the event sits underneath
  and picks up the same gesture. No `stopPropagation`/`preventDefault` boundary between the
  chip's drag source and the event's drag source.

## 5. Middle-Click — Split Event

**Desired** (#657):
- Middle-clicking an event splits it into two adjacent events at the clicked time
  position: original event's end trimmed to the click point, new event created from that
  point to the original's original end.
- Both resulting events keep the source event's fields (course, instructors, rooms, etc.)
  except the split time boundary.
- Single click at the desired split point is enough — no drag required.

**Current behavior:**
- Not implemented. No `button === 1` (middle-click) handler exists anywhere under
  `components/schedule/calendar/` or `event-component/`. The only "split" code in the tree
  (`calendar/split/segments.ts`, `segment-layout.ts`) splits an event's *rendering* across
  prayer/break windows — unrelated to this user gesture.

## 6. Shift+Click — Split Event

**Desired** (#657, alternative gesture to middle-click, matching LuzApp):
- Shift+clicking an event splits it the same way middle-click does (see section 5):
  original trimmed to the click point, new event created for the remainder, both keeping
  the source event's fields.
- Offered as an alternative to middle-click for input devices/trackpads where a middle
  button isn't convenient.

**Current behavior:**
- Not implemented. No shift+click-to-split handler exists under
  `components/schedule/calendar/` or `event-component/`. A separate `shiftKey` usage does
  exist in `instructor-dnd/InstructorDndProvider.tsx`, but that's for shift-dragging an
  instructor chip onto an event (role targeting, see #628) — unrelated to splitting.

## Root Cause Summary

- All three interactions read their modifier key from `window`-level `keydown`/`keyup`
  trackers rather than from a live, drag-scoped state machine — react-big-calendar's HTML5
  drag backend doesn't forward modifier state to `onEventDrop`, and this codebase's
  workaround only samples the modifier at the very end of the drag (or, for precision,
  continuously but without any visible mid-drag feedback).
- The opaque-original effect the user sees for every case is react-big-calendar's default
  drag-source styling — it appears regardless of any modifier key and gives no indication of
  which mode (duplicate / precision / plain move) is actually armed.
- A modifier keypress mid-drag interrupting the browser's native HTML5 drag is a separate,
  more serious defect: it silently discards the in-progress drag with no user-visible error.
- Resize has no precision-modifier wiring at all — it's not a regression, the feature was
  never implemented for resize.

## Related Issues

| # | State | Title |
|---|-------|-------|
| 575 | closed | [Feature]: Event duplication using Ctrl+Drag |
| 608 | closed | Ctrl+drag duplicate lands at wrong offset (precision-drag damping conflicts with duplicate modifier) |
| 475 | closed | Ctrl+drag on schedule event should reduce mouse sensitivity for fine time adjustments |
| 628 | closed | Drag without Shift silently demotes a lecturer to instructor on target event (instructor-dnd, not this path) |
| 657 | open | Feature: split an event via middle-click / shift+click (like LuzApp) |
| 653 | open | Calendar page & components audit: data loss on Delete, Hive lesson duplication, filter empty-state failure, and grid edge cases |
