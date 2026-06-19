---
trigger: always_on
---

# Architecture & Quality Standards

- **Design Principles:** Always assess code against DRY and SOLID principles. For new projects, enforce SOLID and push back on poor design before writing code.
- **Optimization:** Proactively point out micro-optimizations during standard code generation.
- **Testing:** Do not generate unit tests unless explicitly requested. If a tested component is altered, always output the updated test cases.
