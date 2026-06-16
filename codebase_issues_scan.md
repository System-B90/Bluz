# Codebase Quality & Infractions Scan

This document identifies unused code, stub components, deprecated fields, code quality issues, and TODO comments within the codebase.

---

## 1. Outdated / Deprecated Requirements (`TODO.md` Analysis)

- **Syllabus Deprecated Time Concept:** `TODO.md` notes that the concept of allocating time to events or modules in syllabuses ("זמן מוקצב") is a deprecated concept. 
  - **Codebase impact:** `wantedHours` is hardcoded to `0` in [HoursBox.tsx](file:///C:/Users/mkupe/.gemini/antigravity/worktrees/bluz/optimize-repo-agentic-dev/ui/src/components/gantt/syllabus-card/HoursBox.tsx#L30) but the "אידיאל" wanted hours display is still present in [HoursBox.tsx](file:///C:/Users/mkupe/.gemini/antigravity/worktrees/bluz/optimize-repo-agentic-dev/ui/src/components/gantt/syllabus-card/HoursBox.tsx#L129-L138).

- **Saturday Week Duty / Sabbath ("יוצאים" / "סוגרים" button):**
  - **Codebase impact:** [ClosingSaturdayChip.tsx](file:///C:/Users/mkupe/.gemini/antigravity/worktrees/bluz/optimize-repo-agentic-dev/ui/src/components/gantt/closing-saturday-chip.tsx) toggle exists to control going home vs staying on base, but this should be located inside the Saturday day block on the weeks view rather than standalone in [WeekPanel.tsx](file:///C:/Users/mkupe/.gemini/antigravity/worktrees/bluz/optimize-repo-agentic-dev/ui/src/components/gantt/curriculum-view/tabs/weeks-tab/WeekPanel.tsx#L159).

---

## 2. Incomplete Features & Code Stubs

- **Gantt Drag & Drop Builder Tab (`MODULE` Drag End):**
  - **Codebase location:** [builder-tab/index.tsx](file:///C:/Users/mkupe/.gemini/antigravity/worktrees/bluz/optimize-repo-agentic-dev/ui/src/components/gantt/curriculum-view/tabs/builder-tab/index.tsx#L93)
  - **Issue:** Drop handling check `if (activeData.type !== "MODULE") { // TODO: Implement return; }` is a stub and does not support alternative dragged types.

- **Gantt SVAR Calendar Tasks Mapping:**
  - **Codebase location:** [UseGanttData.ts](file:///C:/Users/mkupe/.gemini/antigravity/worktrees/bluz/optimize-repo-agentic-dev/ui/src/components/gantt/curriculum-view/tabs/gantt-view-tab/UseGanttData.ts#L40)
  - **Issue:** Uses fallback hardcoded dates: `// TODO: Implement this properly` / `const startDate: Date = dayjs().toDate();` / `const endDate: Date = dayjs(startDate).add(1, "day").toDate();`.

- **Stub component `HiveModulesView`:**
  - **Codebase location:** [module-dialog/utils.tsx](file:///C:/Users/mkupe/.gemini/antigravity/worktrees/bluz/optimize-repo-agentic-dev/ui/src/components/gantt/module-dialog/utils.tsx#L8)
  - **Issue:** Returns an empty `<Box></Box>` with a `// TODO: Implement.` comment.

- **Partial Drizzle DB Schema Filtering:**
  - **Codebase location:** [db-mappings.ts](file:///C:/Users/mkupe/.gemini/antigravity/worktrees/bluz/optimize-repo-agentic-dev/ui/src/api-server/gantt/db-mappings.ts#L41)
  - **Issue:** Filtering by `weekIds` is commented out (`// TODO: Implement`) and has no actual implementation.

- **Superfluous `apiGetHiveRooms`:**
  - **Codebase location:** [hive.tsx](file:///C:/Users/mkupe/.gemini/antigravity/worktrees/bluz/optimize-repo-agentic-dev/ui/src/api-client/hive.tsx#L39)
  - **Issue:** Room collection fetching has a TODO asking if it is needed since Rooms are subclassed under classes in Hive: `// TODO: Is this function actually needed? Rooms are a subtype of class in Hive`.

---

## 3. UI Bugs and Alignment Issues

- **React Next.js Performance Optimization:**
  - **Codebase location:** [gantt/page.tsx](file:///C:/Users/mkupe/.gemini/antigravity/worktrees/bluz/optimize-repo-agentic-dev/ui/src/app/(themed)/(post-auth)/(with-hive)/gantt/page.tsx#L1)
  - **Issue:** Component marked `"use client"` has a `// TODO: This should be a server component to better performance` comment, but client state context providers block server components.

- **MUI RTL Tabs Layout Bug:**
  - **Codebase location:** [tabs/index.tsx](file:///C:/Users/mkupe/.gemini/antigravity/worktrees/bluz/optimize-repo-agentic-dev/ui/src/components/gantt/curriculum-view/tabs/index.tsx#L49)
  - **Issue:** Employs flex direction overrides to combat MUI horizontal scroll in RTL mode: `flexDirection: "row-reverse", // TODO: Known issue: https://github.com/mui/material-ui/issues/30409?issue=mui%7Cmaterial-ui%7C30207`.

- **Gantt View Row labels language:**
  - **Codebase location:** [GanttView.tsx](file:///C:/Users/mkupe/.gemini/antigravity/worktrees/bluz/optimize-repo-agentic-dev/ui/src/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttView.tsx)
  - **Issue:** Labels/Tooltips should be translated to Hebrew in the timeline view representation (e.g. constraints names).
