---
name: material-ui-tailwind
description: Integrates Material UI with Tailwind CSS v4 using cascade layers (enableCssLayer, @layer order) and documents Tailwind v3 interoperability (preflight, important, injectFirst, portals). Use when combining MUI with Tailwind utilities, slotProps className, or theme token bridges.
license: MIT
metadata:
  author: mui
  version: '1.0.0'
---

# Material UI and Tailwind CSS

Agent skill for MUI + Tailwind. SKILL.md is the entry; AGENTS.md is the full guide.

## When to apply

- Tailwind utilities not overriding MUI (specificity / layer order)
- Setting up v4 with Next.js App or Pages Router, or Vite
- `className` / `slotProps.*.className` on MUI components
- Mapping `--mui-*` variables into Tailwind `@theme`
- Legacy v3 setup (`preflight`, `important`, `injectFirst`, portal `container`)
