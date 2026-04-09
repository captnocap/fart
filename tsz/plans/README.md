# Plans

`tsz/plans/` is the holding area for implementation plans that are worth preserving while the code is still moving.

These files are not polished architecture docs. They are working documents:

- design sketches before code exists
- sequencing notes for multi-step refactors
- risk lists for messy migrations
- snapshots of intent when the final implementation may drift

## What Belongs Here

Use this folder when the work is real enough to deserve a written plan, but not stable enough to be treated as permanent documentation in `tsz/docs/`.

Good examples:

- a compiler refactor that will land across several commits
- a runtime migration that may stall halfway through
- an emit/layout rewrite where the constraints matter more than the final syntax
- a recovery plan for a broken subsystem

Bad examples:

- finished reference docs that should live in `tsz/docs/`
- random scratch notes with no implementation value
- generated output or post-build artifacts

## File Conventions

- Active or relevant plans should use a numeric prefix plus slug: `003-real-atoms.md`
- Keep one plan per file
- Start with a title, date, and status
- Be explicit about whether the file is `draft`, `active`, `paused`, `shipped`, or `superseded`

The numbering is just an ordering aid. It does not imply priority, approval, or completion.

## Expected Shape

Every useful plan should answer most of these:

1. What problem is being solved?
2. Why now?
3. What is the proposed approach?
4. What files or subsystems are likely involved?
5. What are the risks, gaps, or open questions?
6. How will we know the work is done?

If implementation diverges from the plan, update the file with a short note rather than silently pretending the original plan was correct.

## Status Reality

A plan living here does not mean the work shipped.

Plans can be:

- partially implemented
- abandoned
- replaced by a different approach
- useful only as historical context

That is normal. This folder records intent, not victory.

## `done?/`

The `done?/` subdirectory is historical overflow for plans that are mostly shipped, mostly obsolete, or just awkward to delete. The name is intentionally skeptical.

If a plan turns into durable documentation, move the durable version to `tsz/docs/` and leave a short pointer behind only if the history still helps.

## Current Example

`003-real-atoms.md` is a good example of the tone expected here: direct problem statement, concrete proposed structure, and explicit file-level intent.
