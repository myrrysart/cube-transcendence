# Tasks

This folder contains tasks as defined by the specificiation of [Tatr](https://github.com/tsoding/tatr).

<img src="https://raw.githubusercontent.com/tsoding/tatr/main/cover/cover-512.png" width=512>

## Quick Start on Linux

```console
$ git clone https://github.com/tsoding/tatr
$ cd tatr
$ cc -o nob nob.c
$ ./nob
$ sudo cp ./build/tatr /usr/local/bin/
```

After that run `tatr ls` anywhere within this repo to get the list of currently opened tasks. Use `tatr help` to list all the available subcommands of the tool.

## Project tag convention

[`tags`](tags) is Tatr's optional tag registry. It defines this project's
workflow, work-kind, owner, and area tags. Every open task has exactly one
workflow tag: `ready`, `work`, or `review`. A task in `work` or `review` also
has one `owner-<42-login>` tag. `CLOSED` is the only completed status.

Use `kind-*` tags for the work's dominant type. They mirror Conventional
Commits without forcing one task to equal one commit. Use area tags such as
`onboarding` alongside these labels.
