# Material UI theming and design tokens

Version 1.0.0 (Material UI v9)

> **Version notice:** This skill targets Material UI v9 (`>=9.0.0 <10.0.0`). If you are using a different major version, verify the API details before following this guidance.

> Note: This document is for agents and LLMs implementing themes and design tokens with Material UI. Grounded in `docs/data/material/customization/` (theming, palette, dark-mode, css-theme-variables, typography, spacing, shape).

---

## Abstract

A Material UI theme is a single object of design tokens (palette, typography, spacing, shape, breakpoints, etc.) plus optional per-component defaults (`theme.components`). Apps typically call `createTheme` once (or in composed steps), pass the result to `ThemeProvider` near the root, and read values with `useTheme`, `sx`, or `styled`. For system-driven light/dark, prefer `colorSchemes` and related APIs over a static `palette.mode`-only setup when you need toggling, tab sync, and SSR-friendly behavior; enable `cssVariables` when you want `theme.vars`, fewer theme nests for dark regions, and clearer debugging via `--mui-*` CSS variables.

---

## Table of contents

1. [Core setup](#core-setup)
2. [Where tokens live (design token map)](#where-tokens-live-design-token-map)
3. [Palette quick facts](#palette-quick-facts)
4. [Color schemes vs palette-only dark](#color-schemes-vs-palette-only-dark)
5. [CSS theme variables (`cssVariables: true`)](#css-theme-variables-cssvariables-true)
6. [Typography and spacing](#typography-and-spacing)
7. [Composing and merging themes](#composing-and-merging-themes)
8. [Nesting `ThemeProvider`](#nesting-themeprovider)
9. [Custom tokens (brand-specific design keys)](#custom-tokens-brand-specific-design-keys)
10. [Windows High Contrast mode (`enhanceHighContrast`)](#windows-high-contrast-mode-enhancehighcontrast)
11. [Further reading](#further-reading)

---

## Core setup

1. `import { createTheme, ThemeProvider } from '@mui/material/styles'` (Material UI default theme).
2. Build a theme with `createTheme({ ... })`; wrap the app in `<ThemeProvider theme={theme}>` so descendants receive context.
3. Use `<CssBaseline />` inside the provider when you want baseline element styles and correct dark background behavior (see [Dark mode](https://mui.com/material-ui/customization/dark-mode.md)).

Access in components: `useTheme()` from `@mui/material/styles`.

---

## Where tokens live (design token map)

| Area          | Role                                                                                    | Doc                                                                                |
| :------------ | :-------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------- |
| `palette`     | Semantic colors (`primary`, `secondary`, `error`, …), text, background, divider, action | [Palette](https://mui.com/material-ui/customization/palette.md)                    |
| `typography`  | `fontFamily`, `fontSize`, variants (`h1` through `body2`, `button`, …)                  | [Typography](https://mui.com/material-ui/customization/typography.md)              |
| `spacing`     | `theme.spacing(n)` scale (default 8px per unit)                                         | [Spacing](https://mui.com/material-ui/customization/spacing.md)                    |
| `shape`       | `borderRadius` (default 4); optional extra radii need TypeScript augmentation           | [Shape](https://mui.com/material-ui/customization/shape.md)                        |
| `breakpoints` | Responsive keys for `sx` / media queries                                                | [Breakpoints](https://mui.com/material-ui/customization/breakpoints.md)            |
| `zIndex`      | Layering tokens                                                                         | [z-index](https://mui.com/material-ui/customization/z-index.md)                    |
| `transitions` | Duration / easing helpers                                                               | [Transitions](https://mui.com/material-ui/customization/transitions.md)            |
| `components`  | Per-component `defaultProps`, `styleOverrides`, `variants`                              | [Theme components](https://mui.com/material-ui/customization/theme-components.md)  |

---

## Palette quick facts

- Each semantic color (`primary`, `secondary`, `error`, `warning`, `info`, `success`) auto-generates `main`, `light`, `dark`, `contrastText` when you supply only `main`.
- `palette.mode` (default `'light'`) swaps background, text, and action token values automatically.
- Override individual tokens: `createTheme({ palette: { primary: { main: '#1976d2' } } })`.
- `alpha`, `darken`, `lighten` from `@mui/material/styles` are useful for derived tokens.

See [Palette](https://mui.com/material-ui/customization/palette.md).

---

## Color schemes vs palette-only dark

### `palette.mode` only (simple)

```ts
createTheme({ palette: { mode: 'dark' } })
```

- Static; the whole app renders in one mode.
- Toggle by re-rendering with a new theme.
- No SSR synchronization; may flash on hydration.

### `colorSchemes` (recommended for toggling)

```ts
createTheme({
  colorSchemes: { light: true, dark: true },
})
```

- MUI adds a `data-mui-color-scheme` attribute to `<html>`.
- `useColorScheme()` returns `{ mode, setMode }` — works across tabs and survives navigation.
- Combine with `cssVariables: true` for SSR-safe dark mode (no flash).

See [Dark mode](https://mui.com/material-ui/customization/dark-mode.md).

---

## CSS theme variables (`cssVariables: true`)

```ts
createTheme({ cssVariables: true })
```

Effects:
- MUI emits `--mui-palette-primary-main`, `--mui-spacing`, etc. as CSS custom properties on `:root` (and per-scheme on `[data-mui-color-scheme="dark"]`).
- `theme.vars` mirrors the token structure but values are CSS variable references (e.g., `theme.vars.palette.primary.main` = `'var(--mui-palette-primary-main)'`). Use in `sx` / `styled` for values that update automatically when the scheme changes, without nested `ThemeProvider`.
- `applyStyles('dark', { ... })` helper inside `styled` / `sx` applies a style object only in dark mode using the CSS variable layer — no JS re-render needed.

Server-side: add `InitColorSchemeScript` before `<body>` to prevent scheme flash. See [Preventing SSR flicker](https://mui.com/material-ui/customization/dark-mode.md#preventing-ssr-flicker).

See [CSS theme variables overview](https://mui.com/material-ui/customization/css-theme-variables/overview.md).

---

## Typography and spacing

**Typography:**
- `createTheme({ typography: { fontFamily: '"Inter", sans-serif', fontSize: 14 } })`.
- Override individual variants: `typography: { h1: { fontSize: '3rem', fontWeight: 700 } }`.
- `theme.typography.pxToRem(n)` converts px to rem using the configured `htmlFontSize`.

**Spacing:**
- `theme.spacing(1)` = `8px` by default; pass a factor array `[0, 4, 8, 16, 32, 64]` or a custom function to change the scale.
- `sx={{ mt: 2 }}` is shorthand for `marginTop: theme.spacing(2)`.

See [Typography](https://mui.com/material-ui/customization/typography.md), [Spacing](https://mui.com/material-ui/customization/spacing.md).

---

## Composing and merging themes

`createTheme` can be called multiple times to compose:

```ts
const base = createTheme({ palette: { primary: { main: '#1976d2' } } });
const full = createTheme(base, { typography: { fontFamily: 'Inter' } });
```

Or use `deepmerge` from `@mui/utils` for explicit merging of plain objects before passing to `createTheme`. The second call's values win on conflict.

See [Theming—createTheme](https://mui.com/material-ui/customization/theming.md#createtheme-options-args-theme).

---

## Nesting `ThemeProvider`

Nest a second `ThemeProvider` to scope a sub-tree to different tokens (for example a dark sidebar in a light app):

```tsx
<ThemeProvider theme={outerTheme}>
  <App />
  <ThemeProvider theme={(outer) => createTheme(outer, { palette: { mode: 'dark' } })}>
    <Sidebar />
  </ThemeProvider>
</ThemeProvider>
```

When `cssVariables: true`, use `applyStyles` or scoped CSS variables instead of nesting — it is more performant.

See [Nesting ThemeProvider](https://mui.com/material-ui/customization/theming.md#nesting-the-theme).

---

## Custom tokens (brand-specific design keys)

Add brand tokens to the theme object and augment TypeScript types so `useTheme` / `sx` autocomplete them:

```ts
// theme.ts
declare module '@mui/material/styles' {
  interface Theme { brand: { gradient: string } }
  interface ThemeOptions { brand?: { gradient?: string } }
}

const theme = createTheme({ brand: { gradient: 'linear-gradient(…)' } });
```

Access: `theme.brand.gradient` or `sx={{ background: (t) => t.brand.gradient }}`.

See [Custom variables](https://mui.com/material-ui/customization/theming.md#custom-variables).

---

## Windows High Contrast mode (`enhanceHighContrast`)

```ts
createTheme({ cssVariables: { colorSchemeSelector: 'media' }, colorSchemes: { … } })
```

Pass `enhanceHighContrast: true` (v9+) to automatically adapt tokens when Windows High Contrast (Forced Colors) mode is active.

See [Windows High Contrast](https://mui.com/material-ui/customization/dark-mode.md).

---

## Further reading

- [Theming](https://mui.com/material-ui/customization/theming.md)
- [Palette](https://mui.com/material-ui/customization/palette.md)
- [Dark mode](https://mui.com/material-ui/customization/dark-mode.md)
- [CSS theme variables overview](https://mui.com/material-ui/customization/css-theme-variables/overview.md)
- [Typography](https://mui.com/material-ui/customization/typography.md)
- [Spacing](https://mui.com/material-ui/customization/spacing.md)
- [Theme components](https://mui.com/material-ui/customization/theme-components.md)
