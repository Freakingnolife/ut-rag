# AGENTS.md — Karpathy philosophy + project facts

**Date:** 2026-06-12
**Status:** Approved

## Goal

Rewrite `AGENTS.md` so an agent starting a task here is oriented to *this* codebase
fast, with Andrej Karpathy's coding principles baked in as enforceable rules attached
to concrete repo situations (not a generic philosophy poster).

## Decisions

- **Target file:** all content in `AGENTS.md`. `CLAUDE.md` stays `@AGENTS.md`.
- **Style:** facts-first, philosophy woven in, with a short philosophy preamble at top.
- **Principles to enforce:** think-before-coding / ask-don't-guess; minimum code, no
  premature abstraction; surgical changes only; readable over clever.
- **Scratch scripts:** allowed but quarantined — `scripts/debug_*.ts`, `check_*.ts`,
  `eval_debug.ts`, excluded from tsc, deleted/uncommitted once the question is answered.
- **Next.js-16 warning block:** preserved verbatim (auto-generated, marker-wrapped).

## Sections

1. `# Working in this repo` — preamble: the Karpathy non-negotiables (~6 lines).
2. `## What this is` — RAG chat agent over uniontech3d.com, MiniMax, local index, Next 16.
3. `## The pipeline` — one line per stage → `lib/` file.
4. `## Conventions` — TDD pairing, test-over-script, single-purpose modules, match style.
5. `## Scratch scripts` — quarantine convention + tsconfig exclusion glob.
6. `## Commands` — dev / test / ingest / eval; tsx needs `.env.local` sourced.
7. `## Deploy & runtime gotchas` — MiniMax env, index force-include, Node runtime.
8. Next.js-16 warning block (kept verbatim, marker-wrapped).

## Out of scope

Generic best-practices filler; restating what the code already makes obvious;
unrelated refactoring of the repo.
