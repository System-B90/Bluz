# Bluz

### Product Specification

**Scheduling & Gantt Management Platform**

|                    |                      |
| ------------------ | -------------------- |
| **Product**        | Bluz (*"Bis Luz"*)   |
| **Version**        | 0.2.1                |
| **Status**         | Active Development   |
| **Date**           | 24 June 2026         |
| **Lead Developer** | Michael K. Steinberg |

---

## Table of Contents

- [Bluz](#bluz)
    - [Product Specification](#product-specification)
  - [Table of Contents](#table-of-contents)
  - [1. Executive Summary](#1-executive-summary)
  - [2. Purpose & Problem Statement](#2-purpose-problem-statement)
    - [The problem](#the-problem)
    - [The goal](#the-goal)
  - [4. Product Overview](#4-product-overview)
  - [5. Core Features](#5-core-features)
    - [5.1 Schedule / Calendar](#51-schedule-calendar)
    - [5.2 Gantt / Curriculum](#52-gantt-curriculum)
    - [5.3 Shared Platform Capabilities](#53-shared-platform-capabilities)
  - [6. How It Fits Together](#6-how-it-fits-together)
  - [7. Security & Compliance](#7-security-compliance)
  - [8. Non-Functional Qualities](#8-non-functional-qualities)
  - [9. Roadmap Themes](#9-roadmap-themes)
  - [10. Glossary](#10-glossary)

---

## 1. Executive Summary

**Bluz is a web platform that runs the day-to-day scheduling and the long-term gantt planning of an educational institution (Bis) from a single system.**

Bluz answers the two main scheduling questions of Bis90: *what gets taught over a term*, and *when and where each session happens*. Today these are usually managed in disconnected ecel spreadsheets and Git repositories — error-prone, hard to share, and impossible to keep in sync. Bluz unifies both into one professional web application, backed by enterprise grade databases.

The product delivers two complementary surfaces:

- **Schedule / Calendar** — a live, drag-and-drop calendar for classes, lessons, prayer times, rooms, and instructors, with offline support and real-time sync across clients.
- **Gantt / Curriculum** — a planning tool that turns syllabuses into modules and sessions, then allocates them across the weeks and days of a term under defined constraints.

Both surfaces draw on a single source of organizational truth — students, classes, rooms, and staff — and use one institutional sign-on, so staff move between planning and scheduling without re-entering data or logging in twice. This ensures synchronization between the gantt and the schedule.

---

## 2. Purpose & Problem Statement

### The problem

| Pain point                           | Consequence                                                  |
| ------------------------------------ | ------------------------------------------------------------ |
| Curriculum planned in spreadsheets   | No validation, easy to over- or under-allocate teaching time |
| Schedules managed manually           | Double-booked rooms and instructors, last-minute conflicts   |
| Planning and scheduling disconnected | A curriculum change never reaches the calendar               |
| No real-time collaboration           | Two people edit the same week, one overwrites the other      |
| Fragmented identity & data           | Staff lists and room lists drift out of sync between tools   |

### The goal

Give the institution **one place** to design a curriculum and **one place** to run the calendar — wired to the **same** people, rooms, and classes, accessible to many staff at once, and resilient when the network is not.

---

## 4. Product Overview

Bluz is delivered as a single web application, optimized for a **Hebrew, right-to-left** user experience throughout. It is organized into two product surfaces that share the same identity and organizational data.

```
                         ┌──────────────────────────┐
                         │     Institution Staff    │
                         │  (single sign-on login)  │
                         └─────────────┬────────────┘
                                       │
                    ┌──────────────────┴────────────────────┐
                    ▼                                       ▼
          ┌───────────────────┐                 ┌───────────────────┐
          │   Schedule /      │                 │    Gantt /        │
          │   Calendar        │                 │    Curriculum     │
          │                   │                 │                   │
          │ • Live calendar   │                 │ • Syllabus design │
          │ • Drag & drop     │                 │ • Module planning │
          │ • Offline mode    │                 │ • Term allocation │
          │ • Real-time sync  │                 │ • Constraints     │
          └─────────┬─────────┘                 └─────────┬─────────┘
                    │                                     │
                    └──────────────────┬──────────────────┘
                                       ▼
                        ┌──────────────────────────────┐
                        │  Shared organizational data  │
                        │ students · classes · rooms · │
                        │    instructors · subjects    │
                        └──────────────────────────────┘
```

|                         | **Schedule / Calendar**                  | **Gantt / Curriculum**                            |
| ----------------------- | ---------------------------------------- | ------------------------------------------------- |
| **Question it answers** | *When and where does this happen?*       | *What gets taught, and over which weeks?*         |
| **Primary unit**        | The calendar event                       | The curriculum → syllabus → module → event        |
| **Time horizon**        | Day-to-day, this week                    | The whole term                                    |
| **Standout capability** | Real-time, offline-capable collaboration | Constraint-aware event allocation across the term |

---

## 5. Core Features

### 5.1 Schedule / Calendar

- **Interactive calendar** of class events, prayer times, rooms, and instructors.
- **Drag-and-drop editing** — move and reschedule sessions directly on the calendar.
- **Real-time synchronization** — edits made by one user appear live for everyone viewing the same calendar, so teams plan together without overwriting each other.
- **Offline mode & drafts** — staff can keep working when the connection drops; changes reconcile when they reconnect.
- **Room and instructor awareness** — sessions carry the people and places they need, _surfacing conflicts early_.

### 5.2 Gantt / Curriculum

- **Structured curriculum model** — a curriculum is built from **syllabuses**, broken into **modules**, which contain individual **sessions/events**.
- **Term allocation** — modules and sessions are distributed across the **weeks and days** of a term.
- **Constraint-aware scheduling** — rules restrict how and when material can be placed, preventing invalid or overloaded plans.
- **Visual, Gantt-style planning** — coordinators see the whole term at a glance and rebalance it interactively.
- **Configurable work hours** — default working hours for new term days are set per institution.

### 5.3 Shared Platform Capabilities

- **Single institutional sign-on (SSO)** — one login across both surfaces, via Hive's identity provider.
- **One source of organizational truth** — students, classes, rooms, instructors, and subjects are read from Hive, so both surfaces always reflect the same reality.
- **Hebrew, right-to-left first** — the entire interface is designed RTL, not retrofitted.
- **Modern, responsive UI** — clean, consistent styling with light/dark theming.

---

## 6. How It Fits Together

Bluz is not two separate tools bolted together — it is one platform with two views over a shared foundation:

1. **Identity is shared.** A single sign-on grants access to both surfaces; staff never manage two accounts.
2. **Organizational data is shared.** Rooms, instructors, classes, and students come from one institutional source, so a room that exists for the curriculum is the same room on the calendar.
3. **Planning informs execution.** The curriculum defines *what* should happen across a term; the calendar is where that intent becomes concrete, scheduled sessions.

This design means a change to the institution's master data — a new instructor, a renamed room — is reflected everywhere, and planners and schedulers always work from the same picture.

---

## 7. Security & Compliance

| Area                             | Approach                                                                                                          |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Authentication**               | Centralized single sign-on (SSO / OAuth) through Hive's identity provider — no separate Bluz passwords to manage. |
| **Session integrity**            | Sessions secured with signed tokens and strong symmetric encryption.                                              |
| **Secrets management**           | All credentials and keys held in protected configuration, never in source control.                                |
| **Standards-based cryptography** | Industry-standard hashing, encryption, and signing — no home-grown crypto.                                        |
| **Data segregation**             | Scheduling data and curriculum data are stored in purpose-fit systems, each isolated to its surface.              |

---

## 8. Non-Functional Qualities

- **Reliability** — real-time sync and offline drafts keep work safe through interruptions.
- **Performance** — built on a modern, fast web stack for responsive interaction.
- **Maintainability** — a clean, layered architecture with strict boundaries keeps the system extensible as needs grow.
- **Observability** — structured logging and instrumentation support monitoring and troubleshooting.
- **Portability** — fully containerized, enabling consistent deployment across development, testing, and production.
- **Quality assurance** — automated end-to-end and unit testing guard against regressions.

---

## 9. Roadmap Themes

> Indicative direction, subject to prioritization.

- **Deeper planning ↔ scheduling integration** — push approved curriculum allocations directly onto the calendar.
- **Conflict detection & resolution** — proactive surfacing of room, instructor, and time clashes.
- **Reporting & insight** — utilization of rooms, instructor load, and curriculum coverage.
- **Broader offline and collaboration support** — richer multi-user editing and reconciliation.
- **Cross semester information sharing** — full support for long running courses.

---

## 10. Glossary

| Term                | Meaning                                                       |
| ------------------- | ------------------------------------------------------------- |
| **Bluz**            | The product; from *"Bis Luz."*                                |
| **Surface**         | A major product area — Schedule/Calendar or Gantt/Curriculum. |
| **Curriculum**      | "Gantt"; The full plan of what is taught over a term.         |
| **Syllabus**        | A subject-level breakdown within a curriculum.                |
| **Module**          | A unit of teaching within a syllabus, containing sessions.    |
| **Event / Session** | A single scheduled teaching occurrence.                       |
| **Constraint**      | A rule restricting how sessions may be placed in a term.      |
| **SSO**             | Single Sign-On — one institutional login across the platform. |
| **RTL**             | Right-to-left — the Hebrew interface direction.               |

---

---

*Bluz — one platform for planning the term and running the day.*

**Confidential — for internal distribution.**
