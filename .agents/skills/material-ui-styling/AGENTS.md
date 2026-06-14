# Material UI styling

Version 1.0.0 (Material UI v9)

> **Version notice:** This skill targets Material UI v9 (`>=9.0.0 <10.0.0`). If you are using a different major version, verify the API details before following this guidance.

> Note: This document is for agents and LLMs maintaining or generating Material UI code. It follows [How to customize](https://mui.com/material-ui/customization/how-to-customize.md) and related sources in this repository (`docs/data/material/customization/`, `docs/data/system/`).

---

## Abstract

Material UI stacks four strategies from narrowest to broadest scope. Pick the smallest scope that solves the problem to avoid scattering global rules. The `sx` prop is the default for one-off tweaks; `styled()` is for reusable wrappers; the theme's `components` API is for app-wide consistency; `GlobalStyles` / `CssBaseline` is for baseline HTML or cross-cutting globals.

---

## Table of contents

1. [Quick decision (use in order)](#quick-decision-use-in-order)
2. [One-off: `sx` prop](#1-one-off-sx-prop)
3. [Reusable: `styled()`](#2-reusable-styled)
4. [Global theme: `createTheme({ components })`](#3-global-theme-createtheme-components)
5. [Global CSS: `GlobalStyles` / `CssBaseline`](#4-global-css-globalstyles--cssbaseline)
6. [`sx` vs `styled()`](#sx-vs-styled-differences-agents-should-know)
7. [Imports and consistency](#imports-and-consistency)
8. [Further reading](#further-reading-repo--site)

---

## Quick decision (use in order)

1. Single instance or local layout? → [`sx`](https://mui.com/system/getting-started/the-sx-prop/)
2. Same override in many places? → [`styled()`](https://mui.com/system/styled/) around the MUI component (or a thin wrapper component)
3. All instances of a component should look different by default? → [`theme.components`](https://mui.com/material-ui/customization/theme-components.md) (`styleOverrides`, `variants`, `defaultProps`)
4. Global element baselines (for example all `h1`) or non-component CSS? → [`GlobalStyles`](https://mui.com/material-ui/api/global-styles.md) or [`CssBaseline`](https://mui.com/material-ui/react-css-baseline.md) overrides

Do not jump to global theme overrides for a one-off screen; do not use `sx` for large repeated systems if a themed variant or `styled()` wrapper is clearer.

---

## 1. One-off: `sx` prop

Use when: changing one instance (or a small inline case) with access to the theme.

- All Material UI components support `sx`.
- Supports theme shortcuts (`palette`, `spacing`, breakpoints, etc.), pseudo-selectors, nested selectors, and responsive objects.
- Array syntax: `sx={[base, condition && extra]}` merges styles conditionally — entries applied in order, falsy entries skipped. Prefer this over object spread for conditional `sx`.

Nested parts (slots): target internal slots with global class fragments, for example `'& .MuiSlider-thumb'`. Discover the slot name in DevTools; the pattern is `Mui[Component]-[slot]`. Do not rely on the full hashed class string. Use only the stable `Mui*` fragment.

State styles: MUI uses global state classes (`Mui-disabled`, `Mui-focused`, `Mui-checked`, `Mui-selected`, `Mui-error`, `Mui-expanded`, `Mui-required`). Target them as `'& .Mui-disabled'` or `'&.Mui-disabled'` (without space when the state is on the root element).

See [The `sx` prop](https://mui.com/system/getting-started/the-sx-prop/).

---

## 2. Reusable: `styled()`

Use when: the same customization is needed across several call sites or you want a named component for readability.

Import from `@mui/material/styles` (not `@emotion/styled`) to get theme access:

```ts
import { styled } from '@mui/material/styles';
```

`styled(Component)(({ theme }) => ({ ... }))` — the inner function receives the merged theme and any extra props you forward.

Slot targeting and state classes work the same as `sx` (use `& .MuiSlider-thumb`, `&.Mui-disabled`).

`shouldForwardProp`: use to stop custom props from reaching the DOM:

```ts
styled('div', { shouldForwardProp: (p) => p !== 'open' })<{ open: boolean }>
```

See [`styled()`](https://mui.com/system/styled/).

---

## 3. Global theme: `createTheme({ components })`

Use when: every instance of a component should share the same appearance or default props without wrapping.

```ts
createTheme({
  components: {
    MuiButton: {
      defaultProps: { disableRipple: true },
      styleOverrides: {
        root: ({ theme }) => ({ borderRadius: theme.shape.borderRadius * 2 }),
        sizeLarge: { padding: '12px 24px' },
      },
      variants: [
        { props: { variant: 'dashed' }, style: { border: '1px dashed grey' } },
      ],
    },
  },
});
```

- `defaultProps`: merged with the component's own defaults.
- `styleOverrides`: keyed by slot name (find slots in the component API page under "CSS classes").
- `variants`: match on any combination of props and apply extra styles.

See [Theme components](https://mui.com/material-ui/customization/theme-components.md).

---

## 4. Global CSS: `GlobalStyles` / `CssBaseline`

Use when: resetting element defaults, adding CSS custom property declarations, or injecting CSS that does not belong to a component.

`CssBaseline`: drops an opinionated reset (similar to `normalize.css`) and applies `body` background / text color from the theme. Use `<CssBaseline />` inside `ThemeProvider`.

`GlobalStyles`: renders a `<style>` tag with arbitrary CSS; respects the Emotion cache (inserted in the right location). Use `overridesResolver` or the `overrides` key on `CssBaseline` to add per-element overrides that inherit the theme. See [CSS baseline overrides](https://mui.com/material-ui/react-css-baseline.md#global-reset).

---

## `sx` vs `styled()` differences agents should know

| Feature | `sx` | `styled()` |
|---|---|---|
| Theme access | ✅ (shorthand + function) | ✅ (function callback) |
| Responsive values | ✅ object `{ xs: …, md: … }` | ✅ inside `@media` or theme helpers |
| Reusability | ❌ inline only | ✅ named component |
| Runtime cost | Slightly higher (merged each render) | Lower (class computed once) |
| Good for | One-off layout, spacing | Consistent styled wrappers |

`sx` spacing shorthand (1 unit = `theme.spacing(1)` = `8px` by default): `px`, `py`, `pt`, `pb`, `pl`, `pr`, `mx`, `my`, `mt`, `mb`, `ml`, `mr`. Same for `width`, `height`, `maxWidth`, `minHeight` etc. when passed a number from 0–1 (fraction of 100%) or a theme breakpoint key. See [Spacing](https://mui.com/material-ui/customization/spacing.md).

---

## Imports and consistency

Always import styling utilities from `@mui/material/styles`, not directly from Emotion, so they pick up the MUI theme:

```ts
// ✅ correct
import { styled, useTheme, alpha } from '@mui/material/styles';

// ❌ avoid — no theme context
import styled from '@emotion/styled';
```

Component imports: follow the named import pattern established in the codebase (top-level named imports or direct sub-path, depending on the project's ESLint/bundler setup).

---

## Further reading (repo + site)

- [How to customize](https://mui.com/material-ui/customization/how-to-customize.md)
- [The `sx` prop](https://mui.com/system/getting-started/the-sx-prop/)
- [`styled()`](https://mui.com/system/styled/)
- [Theme components](https://mui.com/material-ui/customization/theme-components.md)
- [CSS baseline](https://mui.com/material-ui/react-css-baseline.md)
