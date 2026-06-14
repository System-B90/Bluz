# Material UI and Tailwind CSS

Version 1.0.0 (Material UI v9)

> **Version notice:** This skill targets Material UI v9 (`>=9.0.0 <10.0.0`). If you are using a different major version, verify the API details before following this guidance.

> Note: For agents and LLMs combining Material UI with Tailwind CSS. Primary source for v4: `docs/data/material/integrations/tailwindcss/tailwindcss-v4.md`. v3: `docs/data/material/integrations/interoperability/interoperability.md` (Tailwind CSS v3).

---

## Abstract

Tailwind CSS v4 integration with Material UI is built on CSS cascade layers: MUI emits styles inside `@layer mui`, and Tailwind's `utilities` layer must come after so utilities can override without `!important`. Enable MUI's layer mode with `enableCssLayer: true` (Next.js via `AppRouterCacheProvider` / shared `createEmotionCache`) or `StyledEngineProvider` with `enableCssLayer` (Vite and other SPAs). Declare layer order (for example `@layer theme, base, mui, components, utilities`) before `@import 'tailwindcss'` (or inject the same string with `GlobalStyles` where the docs show). Tailwind CSS v3 uses a different recipe (preflight off, `important`, `StyledEngineProvider` with `injectFirst`, portal `container`). Prefer v4 for new work when possible.

---

## Table of contents

1. [Tailwind CSS v4 (preferred)](#tailwind-css-v4-preferred)
2. [Next.js specifics](#nextjs-specifics)
3. [Vite and other SPAs](#vite-and-other-spas)
4. [Applying utilities to MUI components](#applying-utilities-to-mui-components)
5. [Theme tokens in Tailwind (`@theme`)](#theme-tokens-in-tailwind-theme)
6. [VS Code IntelliSense](#vs-code-intellisense)
7. [Tailwind CSS v3 (legacy)](#tailwind-css-v3-legacy)
8. [Troubleshooting](#troubleshooting)
9. [Further reading](#further-reading)

---

## Tailwind CSS v4 (preferred)

### Goals

1. Generate Tailwind with the `@layer` directive.
2. Order layers so `mui` comes before `utilities`, so Tailwind utilities override MUI predictably.

See [Tailwind CSS v4 integration—Overview](https://mui.com/material-ui/integrations/tailwindcss/tailwindcss-v4.md#overview).

### Layer stack (typical)

At the top of your global CSS (example from docs):

```css
@layer theme, base, mui, components, utilities;
@import 'tailwindcss';
```

Adjust file paths to your app (`src/app/global.css`, `styles/global.css`, etc.).

---

## Next.js specifics

1. Complete the [Next.js integration—App Router](https://mui.com/material-ui/integrations/nextjs.md#app-router) or [Next.js integration—Pages Router](https://mui.com/material-ui/integrations/nextjs.md#pages-router) setup first.
2. App Router: pass `enableCssLayer: true` to `AppRouterCacheProvider`.
3. Pages Router: pass `enableCssLayer: true` to the shared `createEmotionCache` function that you supply to `AppCacheProvider`.

See [Tailwind CSS v4—Next.js](https://mui.com/material-ui/integrations/tailwindcss/tailwindcss-v4.md#nextjs).

---

## Vite and other SPAs

Use `StyledEngineProvider` from `@mui/material/StyledEngineProvider` with the `enableCssLayer` prop (not `injectFirst`):

```tsx
import StyledEngineProvider from '@mui/material/StyledEngineProvider';

<StyledEngineProvider enableCssLayer>
  <App />
</StyledEngineProvider>
```

See [Tailwind CSS v4—Vite](https://mui.com/material-ui/integrations/tailwindcss/tailwindcss-v4.md#vite).

---

## Applying utilities to MUI components

MUI components accept `className` on their root element. For internal slots, use `slotProps`:

```tsx
<Slider
  className="text-primary-500"
  slotProps={{ thumb: { className: 'bg-white' } }}
/>
```

Utilities applied this way will override MUI layer styles because `utilities` comes after `mui` in the layer order.

See [Tailwind CSS v4—Applying utilities](https://mui.com/material-ui/integrations/tailwindcss/tailwindcss-v4.md#applying-utilities-to-mui-components).

---

## Theme tokens in Tailwind (`@theme`)

When using `cssVariables: true` in MUI's theme, `--mui-*` custom properties are available. Map them into Tailwind's design system:

```css
@theme {
  --color-primary: var(--mui-palette-primary-main);
  --color-secondary: var(--mui-palette-secondary-main);
}
```

This lets you use `text-primary`, `bg-secondary`, etc. in Tailwind utilities while keeping a single source of truth in the MUI theme.

See [Tailwind CSS v4—Theme tokens](https://mui.com/material-ui/integrations/tailwindcss/tailwindcss-v4.md#theme-tokens-in-tailwind).

---

## VS Code IntelliSense

Add the `@source` directive in your CSS to tell Tailwind's language server where to scan for class names (including `className` in `.tsx` files):

```css
@source '../**/*.tsx';
```

See [Tailwind CSS v4—VS Code IntelliSense](https://mui.com/material-ui/integrations/tailwindcss/tailwindcss-v4.md#vs-code-intellisense).

---

## Tailwind CSS v3 (legacy)

Use this only when upgrading to v4 is not feasible.

Key differences from v4:

1. **Disable Preflight** in `tailwind.config.js`: `corePlugins: { preflight: false }` — prevents Tailwind's reset from fighting MUI's baseline.
2. **`important` option**: set `important: '#root'` (or your app root selector) to raise Tailwind specificity without `!important` on every rule.
3. **`StyledEngineProvider injectFirst`**: put MUI styles before Tailwind so Tailwind wins:

   ```tsx
   import StyledEngineProvider from '@mui/material/StyledEngineProvider';
   <StyledEngineProvider injectFirst><App /></StyledEngineProvider>
   ```

4. **Portal container**: MUI portals (Modal, Tooltip, etc.) render outside the app root; set a `container` prop or the `important` selector may not cover them.

See [Tailwind CSS v3—Interoperability](https://mui.com/material-ui/guides/interoperability.md#tailwind-css).

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Tailwind utilities not applying | Layer order wrong or `enableCssLayer` missing | Add `@layer ..., mui, ..., utilities` and `enableCssLayer: true` |
| MUI styles missing entirely | `@import 'tailwindcss'` before layer declaration | Move `@layer` declaration before `@import` |
| Portals unstyled (v3) | `important` selector doesn't reach portals | Set `container` prop on Modal/Tooltip or expand selector |
| TypeScript errors on `className` slot | Slot type may not include `className` | Use `slotProps` with the correct typed key |

---

## Further reading

- [Tailwind CSS v4 integration](https://mui.com/material-ui/integrations/tailwindcss/tailwindcss-v4.md)
- [Interoperability guide (v3 and others)](https://mui.com/material-ui/guides/interoperability.md)
- [Next.js integration](https://mui.com/material-ui/integrations/nextjs.md)
- [CSS cascade layers (MDN)](https://developer.mozilla.org/en-US/docs/Web/CSS/@layer)
