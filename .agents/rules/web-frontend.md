---
trigger: model_decision
description: When working on Web or Frontend
---

# Web Stack Constraints

- **Frameworks:** Use ReactJS and NextJS (strictly assuming the App Router).
- **UI Components:** Use MUI exclusively.
- **Language:** Use TypeScript with extensive type-hinting. Use ESLint for formatting.
- **RTL & Localization:** The UI is localized in Hebrew (RTL). Always use logical CSS properties (e.g., `marginInlineStart`, `paddingInlineEnd`) to ensure layout adapts to RTL flow automatically.
- **Local Development:** Default to host-based Fast HMR development (`npm run dev`) for fast feedback cycles unless changing Nginx proxy or test configurations.
