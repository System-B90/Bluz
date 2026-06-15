# Material UI and Next.js

Version 1.0.0 (Material UI v9)

> **Version notice:** This skill targets Material UI v9 (`>=9.0.0 <10.0.0`). If you are using a different major version, verify the API details before following this guidance.

> Note: This document is for agents and LLMs integrating Material UI with Next.js. Source: `docs/data/material/integrations/nextjs/nextjs.md` and related integration docs in this repository.

---

## Abstract

Material UI uses Emotion for styles. On Next.js you must wire an Emotion cache so SSR and streaming produce correct CSS (prefer injecting styles into `head` instead of only `body`). The `@mui/material-nextjs` package supplies `AppRouterCacheProvider` (App Router) and `AppCacheProvider` / `DocumentHeadTags` (Pages Router). Material UI components ship as client components (`"use client"`); they still SSR but are not React Server Components. Match the package import suffix (for example `v15-appRouter`) to your Next.js major version.

---

## Table of contents

1. [App Router (recommended)](#app-router-recommended)
2. [Pages Router](#pages-router)
3. [Fonts (`next/font`)](#fonts-nextfont)
4. [CSS theme variables and SSR](#css-theme-variables-and-ssr)
5. [Other styling stacks (CSS layers)](#other-styling-stacks-css-layers)
6. [Next.js Link and `component` prop](#nextjs-link-and-component-prop)
7. [Further reading](#further-reading)

---

## App Router (recommended)

### Dependencies

Have `@mui/material` and `next` installed, then add:

- `@mui/material-nextjs`
- `@emotion/cache`

Example: `pnpm add @mui/material-nextjs @emotion/cache`

### Root layout

In `app/layout.tsx`, wrap everything under `<body>` with `AppRouterCacheProvider` from the entry that matches your Next major, for example:

`import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';`

(Use the `v1X-appRouter` path that matches your Next.js version if not on v15.)

Why: it collects CSS from MUI System during server rendering and streaming so styles attach predictably; it is recommended so styles go to `<head>` instead of only `<body>`. See [Next.js integration—Configuration](https://mui.com/material-ui/integrations/nextjs.md#configuration).

### Optional cache `options`

Pass `options` to `AppRouterCacheProvider` to override [Emotion cache options](https://emotion.sh/docs/@emotion/cache#options), for example `key: 'css'` (the default MUI key is `mui`). See [Next.js integration—Custom cache (optional)](https://mui.com/material-ui/integrations/nextjs.md#custom-cache-optional).

### URL hooks and Suspense

Dashboards and internal tools often combine MUI client components with URL-driven UI (filters, tabs, pagination) using `useSearchParams()` from `next/navigation`.

Next.js expects a `<Suspense>` boundary around the part of the tree that uses `useSearchParams` (and similar patterns that opt the route into client-side rendering), otherwise you can get build failures or runtime errors about a missing Suspense boundary.

Practical pattern: keep `app/.../page.tsx` as a server component when possible; render a client subtree that uses components such as `Table`, `Tabs`, or `TextField` and is tied to the query string inside `<Suspense fallback={<Skeleton />}>`.

---

## Pages Router

### Dependencies

Same as App Router, plus:
- `@emotion/server`

Example: `pnpm add @mui/material-nextjs @emotion/cache @emotion/server`

### `_document.tsx`

Import `DocumentHeadTags` and `documentGetInitialProps` from `@mui/material-nextjs/v1X-pagesRouter` and use them in your custom `_document`. This ensures critical CSS is extracted for the initial HTML payload. See [Next.js integration—Pages Router](https://mui.com/material-ui/integrations/nextjs.md#pages-router).

### `_app.tsx`

Wrap with `AppCacheProvider` (same package, pages variant). ThemeProvider goes inside. See [Next.js integration—Pages Router](https://mui.com/material-ui/integrations/nextjs.md#pages-router).

---

## Fonts (`next/font`)

Pass a `next/font` font object's `style.fontFamily` into `createTheme({ typography: { fontFamily } })`. The font is declared on `<html>` by Next.js automatically; MUI reads it through the theme.

Do not add `@import` for the same font inside CSS; `next/font` handles loading and the variable is available.

See [Next.js integration—Fonts](https://mui.com/material-ui/integrations/nextjs.md#using-nextfont).

---

## CSS theme variables and SSR

When using `createTheme({ cssVariables: true })`, MUI emits `--mui-*` CSS custom properties. In a Next.js app, add `InitColorSchemeScript` (from `@mui/material/InitColorSchemeScript`) before `<body>` in your root layout to prevent a flash of wrong color scheme on first load. See [Dark mode—Preventing SSR flicker](https://mui.com/material-ui/customization/dark-mode.md#preventing-ssr-flicker) and [Next.js integration—CSS theme variables](https://mui.com/material-ui/integrations/nextjs.md#css-theme-variables).

---

## Other styling stacks (CSS layers)

When combining MUI with Tailwind CSS or CSS Modules, enable CSS cascade layers so utilities can override MUI predictably:

- Pass `enableCssLayer: true` to `AppRouterCacheProvider` (App Router) or the shared `createEmotionCache` (Pages Router / Vite).
- MUI will emit styles inside `@layer mui`.
- Declare layer order in your global CSS (for example `@layer theme, base, mui, components, utilities;`) before `@import 'tailwindcss'`.

See the `material-ui-tailwind` skill for full details.

---

## Next.js Link and `component` prop

Pass Next.js `Link` to an MUI component via the `component` prop for client-side navigation with MUI styling:

```tsx
import NextLink from 'next/link';
import Button from '@mui/material/Button';

<Button component={NextLink} href="/dashboard">Dashboard</Button>
```

TypeScript: MUI infers props from `component`. If you see type errors, ensure the `href` prop matches what the passed component expects. See [Next.js integration—Link](https://mui.com/material-ui/integrations/nextjs.md#link).

---

## Further reading

- [Next.js integration](https://mui.com/material-ui/integrations/nextjs.md)
- [Emotion cache options](https://emotion.sh/docs/@emotion/cache#options)
- [CSS theme variables](https://mui.com/material-ui/customization/css-theme-variables/overview.md)
- [Dark mode—SSR](https://mui.com/material-ui/customization/dark-mode.md#preventing-ssr-flicker)
