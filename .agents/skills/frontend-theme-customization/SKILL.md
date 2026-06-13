---
name: frontend-theme-customization
description: Guides the agent in styling React interfaces using Material-UI (MUI) themes, implementing RTL Hebrew alignments, and designing micro-interactions and animations.
version: 1.0.0
tags:
  - mui
  - react
  - rtl
  - hebrew
  - micro-interactions
  - animations
---

# Frontend & Theme Customization Skill

This skill documents guidelines for styling React components in Bluz using Material-UI (MUI), handling Hebrew localization and RTL (Right-to-Left) layouts, and implementing responsive, high-fidelity micro-interactions.

## Material-UI (MUI) Styling Constraints

Bluz relies exclusively on **MUI v5/v6** for layout and component design.
- **Component Exclusivity:** Always use MUI components (`Box`, `Grid`, `Typography`, `Button`, `FormControl`, `Select`) rather than raw HTML tags.
- **Styling Utility:** Use the `sx` prop or custom styled wrappers (`styled(...)` from `@mui/material/styles`) instead of standalone CSS classes unless specifically required by third-party plugins (e.g. `react-big-calendar`).
- **Harmonious Palettes:** Access colors directly from `theme.palette` (e.g. `theme.palette.primary.main`, `theme.palette.background.paper`). Avoid hardcoded hex codes for structural elements.

---

## RTL & Hebrew Layout Alignments

Bluz is a Hebrew-first scheduling tool. Layout flows must default to Right-to-Left (RTL).

### 1. Stylis RTL Plugin
RTL formatting is processed automatically using `stylis-plugin-rtl` via custom theme providers. However, manual positioning must respect bidirectional flow:
- Use logical properties: prefer `marginInlineStart` / `marginInlineEnd` over `marginLeft` / `marginRight`.
- For flex alignment, use standard values; verify that layouts flip correctly in RTL mode.

### 2. Full Day and Hebrew Month Names
- Display full day names (e.g., "יום ראשון", "יום שני") on standard viewports rather than short letters ("א", "ב") to provide clear visual cues.
- Translate and adjust calendar headings and date range picker button offsets for right-aligned typography.

---

## Premium Micro-Interactions & Animations

An interactive, responsive interface is key to a premium user experience. Implement subtle animations and transitions on all primary actions.

### 1. Hover Transitions
Any custom clickable element must provide smooth scaling or opacity transitions on hover.
```tsx
const HoverableCard = styled(Card)(({ theme }) => ({
    transition: theme.transitions.create(["transform", "box-shadow"], {
        duration: theme.transitions.duration.shorter,
    }),
    "&:hover": {
        transform: "translateY(-4px)",
        boxShadow: theme.shadows[4],
    },
}));
```

### 2. Customizing MUI Ripples
- Use `TouchRipple` overrides on buttons, action chips, and calendar slot items to provide premium, tactile feedback when clicked.
- Soften active/focus states: use subtle scale, light color shifts, or slight background glows rather than harsh borders.

### 3. Glassmorphism and Gradients
- Implement glassmorphism using semi-transparent background colors combined with `backdropFilter: "blur(...px)"` on dialog boxes and navigation panels.
- Add subtle linear gradients to primary headers or call-to-action buttons to create visual depth:
  `background: "linear-gradient(135deg, theme.palette.primary.main, theme.palette.primary.dark)"`
