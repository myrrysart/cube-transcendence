# Tatr task tracker

<!-- DOC_META: status=review version=1 -->
<!-- DOC_TODO: TATR_CLI_VERSION — confirm the installed Tatr command/version behavior when the team standardizes its toolchain. -->

Tatr is the repository's task tracker. Run it from the repository root; it
manages records under `tasks/`.

`tasks/tags` is the project's tag registry. It is the shared vocabulary for
workflow, work kind, ownership, and area labels. Tatr accepts arbitrary tags,
but use the registry so queries and standups stay consistent.

## Start with the backlog

```console
tatr ls
tatr summary
```

Use `tatr ls` before starting work. It shows each task's identifier, status,
priority, tags, and title. Filter by a tag when the list grows:

```console
tatr ls :onboarding
tatr ls ':onboarding and priority ge 50'
```

## Get a HUID quickly

The HUID is the task directory name shown by `tatr ls`, for example
`20261022-143020-jyniemit` in:

```text
./tasks/20261022-143020-jyniemit/TASK.md:1: OPEN ...
```

Copy that directory segment, not the whole path. Use it to confirm a single
task or print the exact record path:

```console
tatr ls 20261022-143020-jyniemit
tatr find -path-only 20261022-143020-jyniemit
```

`tatr find` also locates closed tasks. To view the task record without typing
its path, pass the printed path to your pager safely:

```console
less -- "$(tatr find -path-only 20261022-143020-jyniemit)"
```

## Create a focused task

One task should have one observable outcome. Give it a verb-led title, an
appropriate priority, and tags that make it discoverable.

```console
tatr new -s <your name here> -p 50 -t frontend -t accessibility "Add keyboard submit shortcut"
```

Tatr creates a `TASK.md` record.
Keep secrets, credentials, and personal data out of task titles and tags.

Give every open task one workflow tag: `ready`, `work`, or `review`. Tasks in
`work` or `review` also carry one `owner-<42-login>` tag. Add one dominant
`kind-*` tag when useful, plus relevant area tags:

```console
tatr new -s jyniemit -p 50 -t ready -t kind-docs -t onboarding "Explain room setup"
```

`CLOSED` is Tatr's completed status. Do not use multiple workflow tags; the
task's body holds standup notes, blockers, and decisions.

## Search the backlog precisely

Tatr's query language filters by tags, priority, and HUID. Quote multi-word
queries so the shell passes them to Tatr as one argument:

```console
tatr ls :onboarding
tatr ls 'not tagged'
tatr ls '[:onboarding or :deployment] and priority ge 50'
tatr ls 20261022-143020-jyniemit
```

Tatr does not search task titles or descriptions. Start with a tag or HUID,
then use `tatr find` to inspect the exact task. Use `tatr ref` before changing
work to see where the task is mentioned elsewhere:

```console
tatr find 20261022-143020-jyniemit
tatr ref 20261022-143020-jyniemit
```

## Edit task context safely

Tatr owns task creation, HUID directories, listing, and queries. Teammates may
edit a task's Markdown title, body, and metadata to keep scope, standup notes,
blockers, decisions, acceptance criteria, and workflow current. Do not move or
rename its task directory, and preserve the Tatr metadata format.

The installed version does not document a status-update command. Check the
local help before relying on a command copied from an online example:
<!-- DOC_TODO: TATR_STATUS_COMMAND — resolve the supported status-update workflow when the team selects or upgrades the Tatr version. -->

```console
tatr help
tatr ls -help
tatr untag -help
```

If the team standardizes a version that documents `tatr ls -update`, use it for
status or tag changes. With the current version, edit the existing `STATUS` or
`TAGS` metadata line during standup; keep one line per property and agree the
lifecycle change with the team.

## Open matching tasks in Vim tabs

Use `tatr ls any` to list all open tasks. Add `tatr ls -c` to search closed
tasks too. The first colon-delimited field is the `TASK.md` path; `xargs -o`
reconnects Vim to the terminal, and `-p` opens each matched task in a tab.

```console
tatr ls any; tatr ls -c
{ tatr ls any; tatr ls -c; } | grep -Fi -- anki | cut -d: -f1 | xargs -r -o vim -p
```

Add a `topen` helper to Bash or Zsh. It opens every task whose displayed line
contains its first argument:

```sh
topen() {
  { tatr ls any; tatr ls -c; } | grep -Fi -- "${1:?search term required}" | cut -d: -f1 |
    xargs -r -o vim -p
}
```

For Fish, add the equivalent function to `~/.config/fish/config.fish`:

```fish
function topen
  set -q argv[1]; or return 2
  begin; tatr ls any; tatr ls -c; end | grep -Fi -- $argv[1] | cut -d: -f1 | xargs -r -o vim -p
end
```

`vim -p` is Vim/Neovim-specific. Replace `vim -p` only with an editor command
that accepts multiple file paths; otherwise leave the helper as a Vim tool.

## Team rules

- Use a new or follow-up task to record newly discovered work.
- Link related task identifiers in descriptions instead of duplicating work.
- Split work that can be independently reviewed.
- Commit task-record changes with the work they describe when practical.

## Useful help

```console
tatr help
tatr ls -help
```

The local CLI uses `-help` for command-specific help, not `--help`.
