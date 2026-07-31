# CLI Reference

The `bluz` CLI is a Python command-line tool for driving the Bluz scheduling &
curriculum API from your terminal. Built with [Typer](https://typer.tiangolo.com/)
and [Rich](https://github.com/Textualize/rich).

## Installation

```bash
pip install ./cli
```

## Authentication

```bash
bluz login           # Interactive — prompts for URL and session token
bluz auth config     # Show current config file location and values
```

## Quick Examples

```bash
bluz iterations list
bluz rooms list
bluz gantt curriculums list
bluz --json events list --start 2026-01-01T00:00:00Z --end 2026-01-08T00:00:00Z
```

## Global Options

| Option | Description |
|---|---|
| `--json` | Emit raw JSON instead of Rich tables |
| `--url` | Override the Bluz base URL for one invocation |
| `--token` | Override the session token for one invocation |
| `--insecure / --secure` | Toggle TLS verification |
| `--quiet` / `-q` | Suppress success/warning chatter — only data and errors |
| `--version` | Print the CLI version |

Global flags are accepted before *or* after the subcommand, so
`bluz gantt curriculums list --json` and `bluz --json gantt curriculums list`
are equivalent.

## Command Reference

The following reference is auto-generated from the CLI source code.

::: mkdocs-typer2
    :module: bluz_cli.main
    :name: bluz
    :pretty: true
