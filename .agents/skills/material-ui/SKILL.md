---
name: material-ui
description: Guides Material UI integration in Bluz, covering Next.js App Router, styling best practices (sx/styled), Tailwind interoperability, and RTL alignment.
version: 1.0.0
tags:
  - mui
  - nextjs
  - tailwind
  - rtl
  - theming
---

# Material UI Integration in Bluz

## 1. Next.js App Router Integration
- Ensure all client components that use MUI are wrapped or run in the correct client boundary context.
- Keep `@mui/material-nextjs` provider configured to ensure SSR styles are injected correctly in `head` rather than `body` to prevent layout shift.

## 2. Styling Best Practices
Always follow the narrowest scope strategy:
1. **One-off Styles:** Use the `sx` prop directly on components.
2. **Reusable Styles:** Create custom styled components using `styled(Component)(({ theme }) => ({}))`.
3. **Global Theme overrides:** Add slot overrides inside `createTheme({ components: { ... } })`.
4. **Global CSS:** Use `GlobalStyles` or standard CSS. Avoid using Tailwind or global CSS to override MUI internals directly.

## 3. Tailwind Interoperability
- Since Tailwind v4 and CSS layers are used, ensure cascade layers are ordered correctly to prevent specificity issues.
- Map `--mui-*` theme variables directly into Tailwind custom utilities or theme variables where necessary.

## 4. RTL & Hebrew Support
- The project is aligned Right-to-Left (RTL).
- Ensure `stylis-plugin-rtl` and `CacheProvider` are correctly initialized for RTL.
- When positioning or applying margins/paddings, use logical properties or `theme.spacing` to respect RTL flow (e.g., `marginInlineStart` instead of `marginLeft`).
