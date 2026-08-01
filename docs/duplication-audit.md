# Code Duplication Audit (DRY)

Scan of `ui/src`, `cli`, and `session-server` with `jscpd` (min 8 lines / 60 tokens).

| | Clones | Duplicated lines | Share |
| --- | --- | --- | --- |
| Before | 38 | 873 | 1.14% |
| After | 9 | 104 | 0.14% |

## Quick Start

```powershell
npx jscpd@4 ui/src cli session-server --min-lines 8 --min-tokens 60 --reporters console --format "typescript,tsx,javascript,python"
npm run typecheck
npm run lint
npm run test:unit
```

---

## Violations found and extracted

### 1. Hive entity dropdowns (3 near-identical components)

`HiveSubjectSelect`, `HiveModuleSelect`, `HiveLessonSelect` each re-implemented
the same MUI `FormControl` + `InputLabel` + `Select`, Hebrew-collated sort,
optional empty entry, and null-normalizing `onChange`.

**Extracted:** `components/base/EntitySelect.tsx` — generic over the id type,
takes `options`/`parseValue`. Each `Hive*Select` is now only its provider lookup
plus scoping.

### 2. Constraint panels (module vs event) — the largest clone (~195 lines)

`ModuleConstraintsView` and `EventConstraintsView` duplicated the entire
create/edit/remove state machine, both draft→payload converters (relational and
temporal, including the comma-string day parsing), the conflict check, the
loading skeletons, and the list/edit-form rendering. The only real difference is
which owner id is stamped on the create payload and which constraints are listed.

**Extracted:**
- `module-dialog/constraints/use-constraint-editor.ts` — `useConstraintEditor(ownerType, ownerId)` owns all state and payload mapping.
- `module-dialog/constraints/ConstraintRows.tsx` — the shared list body, plus `TEMPORAL_CONFLICT_MESSAGE`.

The views now hold only their own chrome (card vs collapsible section, summary
chips, virtual sibling constraints).

### 3. Cut preview tabs (~157 lines)

`cut-preview-tab` and `timeframe-events-tab` duplicated the preview state gate
(loading / error / validation errors), the prev–start–next stepper, the toolbar
strip, and the outer full-height column.

**Extracted:** `cut-preview-tab/PreviewShell.tsx` — `renderPreviewBlockers`,
`PreviewNavigation`, `PreviewToolbar`, `PreviewLayout`, `PreviewLoading`,
`PreviewValidationErrors`, `PREVIEW_BUTTON_GROUP_SX`. (The old re-exports from
`cut-preview-tab/index.tsx` are kept, so existing imports still work.)

### 4. Drafts vs snapshots toolbar menus (~123 lines)

`DraftsMenu` and `SnapshotMenu` duplicated the popover shell: trigger button,
anchor state, "name + create" row, loading spinner, empty text, and the row list
with disabled-while-busy icon actions.

**Extracted:** `schedule/calendar/calendar/CalendarStoreMenu.tsx` — generic over
the entry type, with a declarative `actions` array. Each menu keeps only its API
calls, snackbar text, and (for snapshots) the out-of-range confirm dialog.

### 5. Intra-file clones

| File | Duplication | Extraction |
| --- | --- | --- |
| `DayCapacityCell.tsx` | Muted and editable cell repeated the header row and the cell padding/background `sx` | `DayHeaderRow` component + local `cellSx` |
| `GanttSyllabusGroup.tsx` | Day-mode and week-mode span cells repeated the whole `TableCell` + span-bar markup; both span memos re-walked the module/event mappings | `SyllabusSpanCell` component, module-scope `computeSpanVariant` / `getSpanBorderRadius`, shared `mappedDays` memo |
| `ModuleItem.tsx` | Sortable and draggable variants repeated color/title/hours derivation and the meta row | `useModuleItemPresentation` hook + `ModuleItemMeta` |
| `SettingsProvider.tsx` | `updatePrayerTimes` / `updatePrayerTime` repeated the save + rollback + snackbar block | `persistPrayerTimes` callback |
| `mongo-db-controller.ts` | `resolveIterationDb` / `resolveWritableIterationDb` repeated the registry lookup | private `lookupIterationDb(id, writable)` |
| `iteration-request.ts` | Both resolvers repeated the `it` query-param parsing | exported `iterationIdFromRequest` |
| `base-link.ts` | POST and DELETE repeated staff gate + id check + body parse | `readLinkRequest<TBody>` |

### 6. Calendar toolbar button styles

The fullscreen/visibility buttons repeated the same hover-tint, press-shrink and
`pulse-expand` keyframes in both `CalendarToolbar.tsx` and `calendar/index.tsx`.

**Extracted:** `schedule/calendar/calendar/toolbar-button-sx.ts` —
`CONTROL_BUTTON_SX`, `PULSING_ICON_BUTTON_SX`, `GROWING_CONTROL_BUTTON_SX`.

### 7. Event duration math

`EventDurationLabel` and `EventTooltipContent` both converted the event times to
`moment`, diffed minutes, and split hours/minutes.

**Extracted:** `schedule/event-component/use-event-duration.ts`. The label
strings stay per-component (they intentionally differ).

### 8. Calendar store routes

`app/api/calendar/drafts/route.ts` and `.../snapshots/route.ts` repeated event
normalization and the `?id=` requirement.

**Extracted:** `api-server/calendar-store-request.ts` — `normalizeStoredEvents`,
`requireIdParam`.

---

## Known remaining clones (left deliberately)

All are ≤16 lines and mostly incidental MUI markup; extracting them would add
indirection without reducing real coupling.

| Lines | Location | Why left |
| --- | --- | --- |
| 16 | `RelationalDraftFields.tsx` (intra-file) | Two adjacent delay fields; a wrapper would be longer than the markup |
| 14 | `CurriculumActionItems.tsx` ↔ `syllabuses-actions-box/index.tsx` | Same action list rendered in two shells with different callbacks |
| 13 | `GanttEventLabelCell.tsx` ↔ `GanttModuleRow.tsx` | Sticky label cell `sx`; a shared constant is a reasonable follow-up |
| 13 | `CreateFromTemplateAction.tsx` ↔ `ApplyTemplateButton.tsx` | Template picker dialog body — candidate for a future `TemplatePickerDialog` |
| 13 | `ModuleEventsView.tsx` ↔ `ModulesTable.tsx` | Table header rows over different columns |
| 13 | `ImportExportMenuButton.tsx` ↔ `ActionItemButton.tsx` | Menu item button styling |
| 12 | `api-server/gantt/cut.ts` ↔ `execution.ts` | Similar occurrence loops over different domain types |
| 10 | drafts ↔ snapshots `route.ts` | The remaining GET handler shape; the two stores have different DB modules |
| 9 | `GanttModuleRow.tsx` ↔ `GanttSyllabusGroup.tsx` | Week-index span memo |

## Verification

`npm run typecheck`, `npm run lint`, and `npm run test:unit` (63 files, 619
tests) all pass after the refactor.
