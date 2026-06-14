---
name: material-ui-styling
description: Chooses the right Material UI styling approach (sx, styled, theme overrides, global CSS) from official MUI guidance. Use when styling @mui/material components, customizing themes, overriding slots, or comparing sx vs styled.
license: MIT
metadata:
  author: mui
  version: '1.0.0'
---

# Material UI styling

Agent skill for picking the correct styling layer in Material UI (narrowest scope first). SKILL.md is the entry and index; AGENTS.md is the full guide.

## When to apply

- Choosing among `sx`, `styled()`, theme `components`, or global CSS for a change
- Overriding component slots or state safely
- Comparing `sx` vs `styled()` semantics (spacing, theme shortcuts)

## Sections in AGENTS.md (by priority)

1. Quick decision (use in order)
2. One-off: `sx` prop
3. Reusable: `styled()`
4. Global theme: `createTheme({ components })`
5. Global CSS: `GlobalStyles` / `CssBaseline`
6. `sx` vs `styled()` differences
7. Imports and consistency
