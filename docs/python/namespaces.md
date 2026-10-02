# API namespaces

Each namespace hangs off a session: `bz.rooms`, `bz.gantt.curriculums`, …
`bz.<namespace>.help()` prints the same list in a terminal.

## Iterations

::: bluz.api.iterations.IterationsAPI

## Directories

::: bluz.api.directory.CoursesAPI

::: bluz.api.directory.RoomsAPI

::: bluz.api.directory.OutsidersAPI

::: bluz.api.directory.ColorsAPI

::: bluz.api.directory.ReservationsAPI

## Calendar

::: bluz.api.calendar.EventsAPI

::: bluz.api.calendar.DraftsAPI

::: bluz.api.calendar.SnapshotsAPI

## Gantt

`bz.gantt.<entity>` all share the `GanttEntityAPI` surface; each adds what
only its entity has.

::: bluz.api.gantt.GanttAPI

::: bluz.api.gantt.GanttEntityAPI

::: bluz.api.gantt.CurriculumsAPI

::: bluz.api.gantt.SyllabusesAPI

::: bluz.api.gantt.ModulesAPI

::: bluz.api.gantt.GanttEventsAPI

::: bluz.api.gantt.WeeksAPI

::: bluz.api.gantt.DaysAPI

## Settings, integrations and platform

::: bluz.api.platform.SettingsAPI

::: bluz.api.platform.PersonalSettingsAPI

::: bluz.api.platform.GoogleCalendarAPI

::: bluz.api.platform.HiveAPI

::: bluz.api.platform.AiAPI

::: bluz.api.platform.StudentViewAPI

::: bluz.api.platform.SystemAPI
