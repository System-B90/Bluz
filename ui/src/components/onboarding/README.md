# `onboarding/`

An in-house guided-tour and help-panel engine for MUI apps: an anchor registry,
a step runner with a spotlight overlay, and a persistent help drawer.

**Generic by construction.** Nothing here knows what a curriculum, a syllabus or
a cut is. It imports `react` and `@mui/material` only, and is written to be
lifted out to `@system-b90/onboarding` the same way the command palette became
[`@system-b90/command-palette`](https://github.com/System-B90/command-palette) —
so the extraction is a package manifest and an alias rewrite, not a rewrite.

Bluz's own tours, Hebrew copy and anchors live one directory over, in
[`app-onboarding/`](../app-onboarding/README.md).

## Quick Start

```tsx
// 1. Mount the provider once, above everything that contributes a tour or an
//    anchor, with the language you want.
import { OnboardingProvider } from "@/components/onboarding";
import { HE_LABELS } from "@/components/onboarding/labels/he";

<OnboardingProvider labels={HE_LABELS} storageNamespace="bluz">
    {children}
</OnboardingProvider>;
```

```tsx
// 2. Mark the things a tour points at.
import { useTourAnchor } from "@/components/onboarding";

<Tabs ref={useTourAnchor("gantt.tabs")} />;
```

```tsx
// 3. Contribute the tour from the component that owns that screen.
import { useTour } from "@/components/onboarding";

const TOUR = {
    id: "gantt.intro",
    title: "סיור בגאנט",
    autoStart: true,
    steps: [
        {
            id: "tabs",
            title: "חמש תצוגות",
            body: "כל לשונית היא זווית אחרת על אותו גאנט.",
            anchor: "gantt.tabs",
            placement: "block-end",
        },
    ],
} as const satisfies Tour;

useTour(TOUR);
```

```tsx
// 4. Give returning users a way back in.
import { HelpButton } from "@/components/onboarding";
```

## The model

| Concept | What it is |
| --- | --- |
| **Anchor** | A stable id (`"gantt.tabs"`) mapped to a live element by `useTourAnchor`. Steps never hold selectors. |
| **Step** | Title, body, an optional anchor, a logical placement, and optional `beforeShow` / `optional` / `interactive` flags. |
| **Tour** | An ordered list of steps behind a stable `id`, registered by `useTour` and persisted by that id. |
| **Topic** | An entry in the help drawer, registered by `useHelpTopics`, optionally offering to replay a tour. |

Steps resolve at run time, one at a time:

1. `beforeShow` runs and is awaited — this is where a tour opens a drawer or
   switches to the tab holding the next anchor.
2. The runner waits (up to `anchorTimeoutMs`, 4s) for the anchor to register.
3. If it never arrives: an `optional` step is skipped, any other step degrades
   to a centred, anchor-less card rather than stalling the tour.

That is why a tour can safely describe UI that only exists in some states, and
why a step is never left pointing at nothing.

## Persistence

`storageNamespace` prefixes one `localStorage` key holding, per tour id, the
version seen and whether it was completed or dismissed. Dismissing counts as
seen — a tour the user walked out of does not ambush them next session.

- Rewrote a tour? Bump `Tour.version` and everyone sees it again.
- Need "seen" to follow the user across devices? Pass a `storage` prop backed by
  the profile API — the seam is the whole of `OnboardingStorage`.

## Theme, RTL and accessibility

- Surfaces are MUI (`Paper`, `Popper`, `Drawer`, palette colors), so light/dark
  and the host's theme tokens apply with no styling of our own to keep in sync.
- Placements are **logical** (`inline-start`, `block-end`) and resolved against
  `theme.direction`, so a Hebrew UI needs no per-step overrides.
- The card is a `role="dialog"` labelled by its title, `Esc` dismisses, `Enter`
  advances, and the arrow keys move in the reading direction of the theme.
- The spotlight is four backdrop panes around a real hole, so `interactive`
  steps let the user press the control being described.

## Language

Two tables ship, one per file — import exactly one:

```tsx
import { EN_LABELS } from "@/components/onboarding/labels/en";
import { HE_LABELS } from "@/components/onboarding/labels/he";
```

Re-word individual strings with `withLabelOverrides(HE_LABELS, { … })` rather
than restating a table. A third language is just an `OnboardingLabels` object.

## Should this file live here?

Yes, if it is generic tour machinery — the registry, the step runner, the
overlay, the help drawer, the label tables.

No, if it names a Bluz concept (a curriculum, a tab, a route) or contains
Hebrew product copy. That belongs in `app-onboarding/`. Keeping this rule is
what keeps the extraction cheap.
