# Examples

Runnable scripts ship inside the package. List and run them with:

```bash
python -m bluz.examples                    # list
python -m bluz.examples walk_curriculum    # run one against your server
```

Each exposes `main(bz)`, so you can also run them from IPython:

```python
from bluz.examples import load
load("weekly_load").main(bz)
```

Excel examples need `pip install "bluz[excel]"`.

| Example                                       | What it does                                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------------------------- |
| [`script_template`](#script_template)         | Boilerplate for a new Bluz script — copy this file and fill in `run()`.                  |
| [`login_and_session`](#login_and_session)     | Every way to get a session — saved login, env vars, explicit token, browser login.       |
| [`walk_curriculum`](#walk_curriculum)         | Walk a curriculum tree and total planned minutes per syllabus and module.                |
| [`build_syllabus`](#build_syllabus)           | Create a syllabus with modules and events from a plain Python outline.                   |
| [`excel_to_syllabus`](#excel_to_syllabus)     | Import syllabuses, modules and events from a flat Excel sheet (one row per event).       |
| [`excel_wide_syllabus`](#excel_wide_syllabus) | Import a hand-made workbook — one sheet per syllabus, bold module header rows.           |
| [`syllabus_to_excel`](#syllabus_to_excel)     | Export a curriculum's syllabuses to the flat Excel layout the importer reads.            |
| [`weekly_load`](#weekly_load)                 | Scheduled hours per course for the coming week, from calendar events.                    |
| [`course_tree`](#course_tree)                 | Print the course tree (Bis90 → Apollo/Mivtzar/Sphinx → shuffles) with linked syllabuses. |
| [`room_utilization`](#room_utilization)       | Booked hours per room for a week — calendar events plus reservations.                    |
| [`shuffle_audit`](#shuffle_audit)             | Check every syllabus's shuffles have the same daily load — the core scheduling rule.     |
| [`compare_iterations`](#compare_iterations)   | Compare event counts and hours by type between this iteration and the previous one.      |
| [`cut_dry_run`](#cut_dry_run)                 | Plan a curriculum cut without writing, and print what it would decide.                   |
| [`safe_bulk_edit`](#safe_bulk_edit)           | Snapshot the calendar, bulk-edit events, and roll back on failure.                       |
| [`export_calendar`](#export_calendar)         | Export a month of the schedule to ICS and to CSV (for Excel / pandas).                   |

## script_template

Boilerplate for a new Bluz script — copy this file and fill in `run()`.

```python
--8<-- "cli/bluz/examples/script_template.py"
```

## login_and_session

Every way to get a session — saved login, env vars, explicit token, browser login.

```python
--8<-- "cli/bluz/examples/login_and_session.py"
```

## walk_curriculum

Walk a curriculum tree and total planned minutes per syllabus and module.

```python
--8<-- "cli/bluz/examples/walk_curriculum.py"
```

## build_syllabus

Create a syllabus with modules and events from a plain Python outline.

```python
--8<-- "cli/bluz/examples/build_syllabus.py"
```

## excel_to_syllabus

Import syllabuses, modules and events from a flat Excel sheet (one row per event).

```python
--8<-- "cli/bluz/examples/excel_to_syllabus.py"
```

## excel_wide_syllabus

Import a hand-made workbook — one sheet per syllabus, bold module header rows.

```python
--8<-- "cli/bluz/examples/excel_wide_syllabus.py"
```

## syllabus_to_excel

Export a curriculum's syllabuses to the flat Excel layout the importer reads.

```python
--8<-- "cli/bluz/examples/syllabus_to_excel.py"
```

## weekly_load

Scheduled hours per course for the coming week, from calendar events.

```python
--8<-- "cli/bluz/examples/weekly_load.py"
```

## course_tree

Print the course tree (Bis90 → Apollo/Mivtzar/Sphinx → shuffles) with linked syllabuses.

```python
--8<-- "cli/bluz/examples/course_tree.py"
```

## room_utilization

Booked hours per room for a week — calendar events plus reservations.

```python
--8<-- "cli/bluz/examples/room_utilization.py"
```

## shuffle_audit

Check every syllabus's shuffles have the same daily load — the core scheduling rule.

```python
--8<-- "cli/bluz/examples/shuffle_audit.py"
```

## compare_iterations

Compare event counts and hours by type between this iteration and the previous one.

```python
--8<-- "cli/bluz/examples/compare_iterations.py"
```

## cut_dry_run

Plan a curriculum cut without writing, and print what it would decide.

```python
--8<-- "cli/bluz/examples/cut_dry_run.py"
```

## safe_bulk_edit

Snapshot the calendar, bulk-edit events, and roll back on failure.

```python
--8<-- "cli/bluz/examples/safe_bulk_edit.py"
```

## export_calendar

Export a month of the schedule to ICS and to CSV (for Excel / pandas).

```python
--8<-- "cli/bluz/examples/export_calendar.py"
```
