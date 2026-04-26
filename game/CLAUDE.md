# game/ — Dead Internet Simulator

## What This Is

A dead internet simulator disguised as an operating system. The player boots into a desktop, browses fake websites, talks to AI-powered NPCs who post, chat, and live autonomous lives. A GGUF language model runs locally inside the binary — no server, no API keys, no network. The NPCs run on your metal.

The twist: if the player "escapes" the OS, the camera pulls back to reveal they're sitting at a terminal inside cs_office (Counter-Strike: Source). There is no internet. There is no outside.

## Layers

1. **Boot** — BIOS POST → GRUB → account creation (Windows setup wizard feel)
2. **Shell** — Desktop environment: taskbar, window manager, wallpaper
3. **Apps** — Each app is a `<Cartridge>` .so loaded by the shell: browser, messenger, social, settings, games
4. **Escape** — BSP viewer integration. The 3D room. The reveal.

## Reference

The TypeScript/Tauri prototype lives at `/home/siah/creative/engaige/`. Reference it for:
- NPC personality system design (20+ traits, quirks, communication patterns)
- Social platform concepts (MyFace, InstaSnap, Threadit)
- Desktop app ideas (messenger buddy list, creative studio, mini-games)
- Event bus architecture pattern

Do NOT reference it for:
- Lore (most of it got out of hand)
- Filler site implementations (many are poorly made)
- Server architecture (we're local-only with GGUF now)
- Budget/cost system (irrelevant with local model)

## Structure

```
game/
  CLAUDE.md               ← you are here
  shared/
    base.cls.tsz          ← shared classifiers for ALL carts (typography, layout, badges, buttons)
  boot/
    boot.app.tsz          ← BIOS POST → GRUB → account setup
    bios.cls.tsz          ← BIOS/boot-specific classifiers
  shell/
    shell.app.tsz         ← the OS desktop (loads app cartridges)
    shell.cls.tsz         ← window chrome, taskbar, desktop classifiers
  apps/
    <app-name>/
      <app-name>.app.tsz  ← cartridge entry point
      <app-name>.cls.tsz  ← app-specific classifiers (imports from shared/base.cls)
      <app-name>.script.tsz  ← app logic (if needed)
  assets/                 ← images, fonts, static data
  ai/                     ← GGUF model integration, NPC personality engine
  escape/                 ← BSP viewer, 3D room, the reveal sequence
```

## File Length Limit (ENFORCED)

**Max 900 lines per `.tsz` file.** Enforced by `game/scripts/check-file-length.sh`. With classifiers handling style and scripts handling logic, no single file should approach this. If it does, split it — extract components into their own `.tsz` files, move logic to `.script.tsz`, or break classifiers into focused groups. Never raise the limit.

## Layout Rule: NO PAGE-LEVEL SCROLL (ENFORCED)

**The root `Page` container NEVER scrolls.** Every cart fits its content within the viewport. If content overflows, it goes inside a `<ScrollView>` nested within the layout — never at the page root. This is non-negotiable.

- `Page` is always `width: 100%, height: 100%` with no overflow
- Scrollable regions are explicit: a feed panel, a chat history, a list — never the whole window
- If your layout doesn't fit, you have too much in one view. Paginate, tab, or collapse — don't scroll the page.

## Cart Scaffold Rules

Every cart in this game MUST follow this pattern:

1. **Import base classifiers** — `import { ... } from '../shared/base.cls'`
2. **Define app classifiers** in a sibling `.cls.tsz` that extends base vocabulary
3. **Script logic** in a sibling `.script.tsz` if non-trivial
4. **No hardcoded colors** in app code — use classifier tokens or theme tokens
5. **No inline styles** for repeated patterns — if you use it twice, it's a classifier

## Build

Each cart compiles to a .so cartridge:
```bash
bin/tsz build game/boot/boot.app.tsz        # boot sequence binary
bin/tsz build game/shell/shell.app.tsz       # OS shell (loads .so carts)
bin/tsz build game/apps/messenger/messenger.app.tsz  # messenger cartridge
```

The shell loads app cartridges at runtime via `<Cartridge src="messenger.so" />`.

## Data: Document Store, Not Tables

**All game data lives in local/document storage — NOT relational tables.** JSON blobs keyed by ID. No schemas, no migrations, no SQL until the data model is stable at the end.

- NPC profiles, player state, conversations, posts — all documents
- Key-value or collection-of-documents pattern
- Shape changes are just new fields on the document — old docs still load fine
- When the game is feature-complete and the data model is proven, THEN migrate to tables if needed

This keeps iteration fast. Don't build a database when a JSON store will do.

## Git Discipline

Same rules as the root `CLAUDE.md` and `AGENTS.md`: main only, no branches, explicit staging. Additionally:

- **Daily checkpoint at 2am and 2pm.** When beginning work around 02:00 or 14:00, run `git status`. If dirty, commit everything as a checkpoint (`checkpoint: <note>`) and move on.

## Linear Development Order

Build what the player sees, in order:
1. Boot sequence (BIOS → GRUB → account creation)
2. Desktop shell (taskbar, wallpaper, empty desktop)
3. First app (the browser or messenger — whatever makes NPCs feel alive first)
4. More apps as the world fills in
5. The escape sequence (last — earned, not given)
