# Fork Bomb Bug — 2026-03-24

## What happened

The `tsz-supervisor` process (cached at `~/.cache/tsz-supervisor/2fb29e2b/`) spawned `db/plan.sh refresh` and `db/tasks.sh refresh` scripts in a cascading chain. Each script forked the next before exiting, creating an exponential process tree that ballooned to ~20,000+ processes and locked the desktop.

## Process chain structure

```
tsz-supervisor (PID 692523)
  └─ sh -c plan.sh refresh 1
       └─ bash plan.sh refresh 1
            └─ bash tasks.sh refresh
                 └─ bash plan.sh refresh
                      └─ bash tasks.sh refresh
                           └─ ... (infinite alternating chain)
```

Each `plan.sh` calls `tasks.sh` and vice versa, with no termination condition. When the parent supervisor was killed, the orphaned chain continued under PID 1 (init).

## How it was stopped

1. `chmod -x` on both `db/plan.sh` and `db/tasks.sh` to prevent new forks
2. Kill loop to mop up remaining processes

## What needs fixing

The mutual recursion between `db/plan.sh` and `db/tasks.sh` needs a termination condition. Likely causes:

- `plan.sh refresh` unconditionally calls `tasks.sh refresh` at the end (or vice versa), creating an infinite loop
- Missing depth/iteration guard — the `refresh 1` arg on the initial call suggests a counter was intended but isn't being checked or decremented
- No `exec` — each call is a fork (subshell) rather than replacing the current process, so every iteration adds a new process instead of reusing one

## Current state

Both scripts have had their execute bit removed (`chmod -x`). Restore with:

```bash
chmod +x db/plan.sh db/tasks.sh
```

after fixing the recursion.
