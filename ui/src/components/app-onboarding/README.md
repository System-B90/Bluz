# `app-onboarding/`

Bluz's contributions to onboarding. This is the **Bluz-specific half** of the
feature — the generic half lives in
[`components/onboarding/`](../onboarding/README.md) and knows nothing about
curriculums, syllabuses or cutting to the schedule.

Built for [#659](https://github.com/System-B90/Bluz/issues/659): the gantt
screen reads as intimidating to a first-time planner, and nothing on it explains
that cutting to the schedule cannot overwrite what is already there.

## Quick Start

```tsx
// Mounted once, in the post-auth layout — wraps the app in the tour engine.
<BluzOnboarding>{children}</BluzOnboarding>
```

```tsx
// Contribute a screen's tour and help topics from the component that owns its state.
<GanttOnboarding setSelectedTabIndex={setSelectedTabIndex} />
```

```tsx
// Mark something a tour points at.
<Fab ref={useTourAnchor(GANTT_ANCHORS.curriculumFab)} />
```

## What is registered where

| File | Registered by | Contributes |
| --- | --- | --- |
| `BluzOnboarding.tsx` | post-auth layout | The provider, with Bluz's Hebrew copy |
| `BluzHelpButton.tsx` | `header/AppBar` | The "?" button, and the `app.help` anchor |
| `gantt/use-gantt-tour.tsx` | `gantt/curriculum-view` | The first-run gantt tour (`gantt.intro`) |
| `gantt/use-gantt-help-topics.tsx` | `gantt/curriculum-view` | The gantt section of the help panel |
| `anchors.ts` | — | Every anchor id the app spotlights |

Anchors are registered by the components that render the elements:
`curriculum-fab` (the picker Fab), `curriculum-view/tabs` (the tab strip),
`curriculum-view/components/sidebars/about-time` (the hours sidebar) and
`syllabuses-actions-box` (the search field).

## The tour

Five concepts, in the order a planner meets them:

1. **What a gantt is** — the plan, not the schedule.
2. **Syllabus → module → occurrence** — where the content lives.
3. **Weeks and the hour budget** — what bounds the plan.
4. **The preview tab** — see the resulting week before writing anything.
5. **Cutting to the schedule** — it only *creates* events; it never deletes or
   overwrites existing ones, a gantt that was already cut is refused a second
   cut, a draft cannot be cut at all, and a pull-back undoes it.

Concept 5 is the reason the issue was filed, so it is also a help topic — the
tour is a one-time thing, the panel is not.

The tour drives the tab strip itself (`beforeShow` switches tabs and waits for
the deferred mount), which is why it is registered by `CurriculumView` rather
than app-wide.

## Should this file live here?

Yes, if it names a Bluz concept — a gantt, a syllabus, a tab, the cut — or
contains Hebrew copy.

No, if it is generic tour machinery (the registry, the step runner, the overlay,
the help drawer). That belongs in `components/onboarding/`, which must stay free
of any knowledge of this app so it can be extracted to
`@system-b90/onboarding` the way the palette was.

## Adding a tour

1. Pick the component that owns the state the tour needs to drive.
2. Build the `Tour` with `useMemo` and pass it to `useTour` — it must be
   referentially stable.
3. Give it a stable `id` (it is the persistence key) and add the anchors it
   points at to `anchors.ts`.
4. Mark steps `optional` when the UI they describe is not always on screen.

## Wording

`labels.ts` builds `ONBOARDING_LABELS` from the package's Hebrew table
(`@/components/onboarding/labels/he`) with `withLabelOverrides` for the strings
Bluz says differently. Import `labels/he` only — pulling in `labels/en` as well
would ship both languages' strings to every user.
