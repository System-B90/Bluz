# ESLint Suppressions (`eslint-disable-next-line`)

| File | Line | Rule | Justification |
|------|------|------|---------------|
| `ui/src/settings.tsx` | 1 | `no-restricted-imports` | Barrel re-export boundary — this file IS the allowed import path |
| `ui/src/components/theme/MuiEmotionCacheProvider.tsx` | 4 | `no-restricted-imports` | RTL stylis plugin has no alternative import path |
| `ui/src/components/theme/CreateFromPalette.ts` | 4 | `consistent-type-definitions` | MUI module augmentation requires `interface` for declaration merging |
| `ui/src/components/settings-dialog/tabs/global/room-settings/index.tsx` | 58 | `exhaustive-deps` | `selectedRoom` intentionally excluded to avoid set→rerun loop |
| `ui/src/components/settings-dialog/tabs/global/outsider-settings/VCardQrCode.tsx` | 94 | `no-img-element` | QR code is data URL; `next/image` doesn't support data URIs |
| `ui/src/components/schedule/calendar/calendar/index.tsx` | 91 | `set-state-in-effect` | Standard hydration guard pattern |
| `ui/src/components/gantt/curriculum-view/tabs/weeks-tab/DayCapacityCell.tsx` | 94 | `set-state-in-effect` | Sync local state from server prop when field unfocused |
| `ui/src/components/gantt/curriculum-view/tabs/weeks-tab/DayCapacityCell.tsx` | 101 | `set-state-in-effect` | Sync local state from server prop when field unfocused |

**Total: 8 suppressions across 6 files. All assessed as justified — no removable suppressions found.**
