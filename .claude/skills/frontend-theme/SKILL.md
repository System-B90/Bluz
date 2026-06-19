---
name: frontend-theme
description: MUI v7 styling, RTL Hebrew layout, animations, and Next.js App Router integration for Bluz.
tags: [mui, rtl, hebrew, react, nextjs, animations]
---

## MUI Rules
- **Components:** always use MUI (`Box`, `Grid`, `Typography`, `Button`, `FormControl`, `Select`), not raw HTML
- **Styling scope:**
  1. One-off → `sx` prop
  2. Reusable → `styled(Component)(({ theme }) => ({}))`
  3. Global → `createTheme({ components: { ... } })`
  4. Global CSS → `GlobalStyles`; never override MUI internals with Tailwind/raw CSS
- **Colors:** `theme.palette.*` only — no hardcoded hex for structural elements
- **Next.js SSR:** `@mui/material-nextjs` provider must inject styles in `<head>`, not `<body>`
- **Tailwind v4 + CSS layers:** ensure cascade order correct; map `--mui-*` vars to Tailwind where needed

## RTL / Hebrew
- App is `dir="rtl"`. `stylis-plugin-rtl` + `CacheProvider` handle auto-flip — must be initialized.
- **Always** use logical CSS: `marginInlineStart`/`marginInlineEnd`, **not** `marginLeft`/`marginRight`
- Calendar: full day names (`יום ראשון`, `יום שני`), not single letters (`א`, `ב`)

## Animations & Micro-Interactions

**Hover card:**
```tsx
const HoverableCard = styled(Card)(({ theme }) => ({
    transition: theme.transitions.create(["transform", "box-shadow"], {
        duration: theme.transitions.duration.shorter,
    }),
    "&:hover": { transform: "translateY(-4px)", boxShadow: theme.shadows[4] },
}));
```

**Glassmorphism (dialogs/nav panels):**
```tsx
{ backdropFilter: "blur(12px)", background: "rgba(255,255,255,0.1)" }
```

**Gradient headers/CTAs:**
```tsx
{ background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})` }
```

- `TouchRipple` overrides on buttons, chips, calendar slots for tactile feedback
- Focus/active: subtle scale or bg shift — no harsh borders
