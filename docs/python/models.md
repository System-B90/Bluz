# Models

Every model is a pydantic model with snake_case attributes over the camelCase
wire. Each class docstring ends with a generated field table that lists the
wire name next to every renamed field.

## Base classes

<!-- prettier-ignore-start -->
::: bluz.models._base.BluzModel
    options:
      members: [from_wire, to_wire, help, bluz]

::: bluz.models._base.Collection
<!-- prettier-ignore-end -->

## Gantt (curriculum tree)

<!-- prettier-ignore-start -->
::: bluz.models.gantt
    options:
      members:
        - Curriculum
        - Syllabus
        - Module
        - GanttEvent
        - Week
        - Day
        - GanttNode
        - GanttSummary
        - DayMapping
        - RecurrenceException
        - EventCurriculumAllocation
        - ModuleEventType
        - RoomRequirement
        - EventRecurrence
        - GanttDayIndex
<!-- prettier-ignore-end -->

## Calendar

::: bluz.models.calendar

## Iterations

::: bluz.models.iterations

## Directories

::: bluz.models.directory

## Settings, session and reports

::: bluz.models.misc
