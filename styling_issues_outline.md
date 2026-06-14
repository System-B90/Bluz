# styling_issues_outline.md

Outline of styling issues, anti-patterns, and integration gaps in the Bluz codebase.

---

## 1. Tailwind & MUI Specificity Integration Gap

**Issue:** Tailwind CSS v4 and MUI are not integrated using CSS cascade layers. This causes conflicts where Tailwind classes cannot reliably override MUI components without using `!important` or high-specificity selectors.

- **Missing Configuration:** `AppRouterCacheProvider` in [MuiEmotionCacheProvider.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/theme/MuiEmotionCacheProvider.tsx) is missing `enableCssLayer: true`.
- **Missing Order Declaration:** [globals.css](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/style/globals.css) does not declare `@layer theme, base, mui, components, utilities` before `@import "tailwindcss"`.
- **Specificity Clashes:** Leads to styling overrides failing when utility classes are used directly on MUI components.

---

## 2. Static Theme & Hydration Flash

**Issue:** The current theme setup in [ThemeProvider.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/theme/ThemeProvider.tsx) reconstructs the entire theme on the client side when the `resolvedTheme` changes.

- **Anti-Pattern:**
  ```tsx
  const paletteMode = mounted && resolvedTheme === "dark" ? "dark" : "light";
  const muiTheme = useMemo(() => createTheme(createFromPalette(paletteMode)), [paletteMode]);
  ```
  This causes a complete component re-render when changing themes and results in a layout/color scheme flash on initial page load (hydration mismatch).
- **Missing CSS Variables:** MUI's `cssVariables: true` is not enabled in the theme options.
- **Missing SSR Script:** The root layout [layout.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/app/layout.tsx) is missing the `<InitColorSchemeScript attribute="class" />` component to prevent flicker.

---

## 3. Disjointed Design Tokens

**Issue:** Dual token system between Tailwind and MUI.
- **Tailwind Tokens:** Tailwind variables (`--background`, `--foreground`, `--primary`, etc.) are declared statically in `@layer base` inside `globals.css`.
- **MUI Tokens:** MUI has separate theme palettes defined in `CreateFromPalette.ts` (e.g. primary main `#67C8DD`).
- **Gaps:** Tailwind class names like `text-primary` or `bg-secondary` use different colors than MUI's `primary` and `secondary` colors. Unify by enabling MUI CSS variables and mapping `--mui-palette-*` variables into Tailwind's `@theme` directive.

---

## 4. Excessive `sx` Prop Usage (Layout Over-Styling)

**Issue:** Many components use the `sx` prop for simple layout and layout spacing that should be handled by Tailwind utility classes. This increases runtime Emotion style generation overhead and bloats the JS bundle.

### Repeated Layout Patterns
- `display: 'flex', flexDirection: 'column'` (20+ files)
- `display: 'flex', alignItems: 'center'` (30+ files)
- `gap: 1` / `gap: 2` (25+ files)

### Hardcoded Values in `sx` Props
Many components hardcode colors, dimensions, and font sizes instead of referencing theme tokens or Tailwind utilities:
- **Colors:** Hex/RGB values like `#f5f5f5`, `#e0e0e0`, and `#1976d2` are hardcoded in components instead of using palette tokens.
- **Dimensions:** Raw widths/heights like `'400px'`, `'600px'`, and `'48px'`.
- **Typography:** Hardcoded font sizes like `'0.75rem'` and `'14px'`.

---

## 5. Deprecated API Usage (`inputProps` / `InputProps`)

**Issue:** Lowercase `inputProps`, uppercase `InputProps`, and `InputLabelProps` are used on text field and selector components. Under MUI v6/v7, these are deprecated in favor of `slotProps`.

- **Files affected:**
  1. [DaysTable.tsx:69](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/gantt/curriculum-view/components/WorkTimePanel/DaysTable.tsx#L69): `inputProps`
  2. [DayCapacityCell.tsx:369](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/gantt/curriculum-view/tabs/weeks-tab/DayCapacityCell.tsx#L369): `inputProps`
  3. [RelationalDraftFields.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/gantt/module-dialog/constraints/RelationalDraftFields.tsx):
     - Line 151: `InputProps`
     - Line 157: `inputProps`
     - Line 170: `InputProps`
     - Line 176: `inputProps`
  4. [InstructorSourceList.tsx:159](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/tabs/global/course-settings/InstructorSourceList.tsx#L159): `InputProps`
  5. [outsider-settings/index.tsx:304](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/tabs/global/outsider-settings/index.tsx#L304): `InputProps`
  6. [RoomListCard.tsx:106](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/tabs/global/room-settings/RoomListCard.tsx#L106): `InputProps`

---

## 6. Monolithic raw CSS in `calendar.css`

**Issue:** [calendar.css](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/style/calendar.css) is a 17KB raw CSS stylesheet containing:
- ~50+ hardcoded colors mimicking theme colors.
- Specificity wars using `!important` (12 occurrences).
- Duplicate styles that overlap with MUI system colors.
