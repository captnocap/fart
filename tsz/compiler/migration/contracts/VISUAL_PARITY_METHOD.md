# Visual Parity Method

Generated: 2026-04-08

Purpose:
- This document defines when visual parity is a required migration proof.
- It exists because emitted bytes are allowed to get cleaner while the rendered app is not allowed to drift.

## Core Rule

When the engine is unchanged and only the compiler realization path changes, visual parity is a real contract check.

In that situation:
- the layout engine is the same
- the paint path is the same
- the text renderer is the same
- the event system is the same
- the framework behavior is the same

The thing under test is therefore:
- did the emitted code drive the same engine into the same visible state

not:
- did two different engines happen to look similar

## Verification Stack

Use these layers together:

1. contract parity
2. byte parity
3. visual parity
4. behavioral parity

Their roles are different:

- `contract parity`
  - proves the same semantic middle record exists
- `byte parity`
  - proves migration discipline during extraction, atomization, and cleanup
- `visual parity`
  - proves the fixed engine rendered the same UI
- `behavioral parity`
  - proves the same interactions produce the same outcomes

## Acceptance Rule

The emitted code is allowed to improve.

The rendered truth is not.

That means:
- byte parity is a migration tool
- visual parity is product truth when the engine is fixed

If bytes differ but contract parity holds and visual parity matches, the new realization path is acceptable.

If bytes differ and visual parity fails, the migration is not acceptable even if the new output is cleaner.

## When Exact Visual Parity Is Required

Exact visual parity is required when all of these are true:
- the engine build is unchanged
- the renderer backend is unchanged
- the font set is unchanged
- the window size is fixed
- the captured frame is deterministic
- the test cart is not intentionally time-varying

In that mode, region hashes and full-screen hashes are expected to match exactly.

## When Perceptual Visual Parity Is Allowed

Perceptual parity is only allowed when a contract says so explicitly.

Examples:
- font hinting differs across environments
- a backend switch is intentional
- the test target contains tolerated raster noise

If perceptual parity is allowed, the contract must name:
- the tolerated cause
- the diff threshold
- the exact comparison mode

Do not silently downgrade exact parity to perceptual parity.

## Capture Discipline

Every visual parity run must fix:
- cart path
- engine build
- renderer backend
- viewport width
- viewport height
- scale factor
- font fingerprint
- frame index or capture point
- deterministic state setup

Do not trust visual hashes captured from mixed environments.

## Region Model

Do not rely on one full-screen hash by itself.

Every visual contract should capture:
- one full-screen hash
- named region hashes
- optional node-target crops when a contract focuses on a known subtree

Region hashes are preferred because they localize failure.

Typical regions:
- `header`
- `sidebar`
- `content`
- `footer`
- `panel_a`
- `panel_b`
- `map_region`
- `overlay`

Contracts should name the exact regions they care about.

## Comparison Modes

Use one of these modes and record it explicitly:

- `exact_hash`
  - full bitmap identity expected
- `exact_hash_regions`
  - full bitmap and named regions must match exactly
- `perceptual_hash`
  - minor pixel drift allowed under a declared threshold
- `pixel_diff_threshold`
  - explicit diff pixel count or ratio threshold declared in the contract

Default mode for compiler migration on a fixed engine:
- `exact_hash_regions`

## Visual Report Shape

Every visual parity report should include at least:
- `cart_path`
- `capture_id`
- `mode`
- `frame_index`
- `width`
- `height`
- `engine_fingerprint`
- `font_fingerprint`
- `backend_tags`
- `full_hash_before`
- `full_hash_after`
- `full_diff_status`
- `region_hashes_before`
- `region_hashes_after`
- `region_diff_status`
- `diff_pixels`
- `diff_ratio`
- `first_diff_region`
- `verification_time`

If the comparison is exact and `full_diff_status` is `match`, the region report must still exist.

## Human Proof

Hash reports are machine proof.

When a visual mismatch occurs, also save:
- the before screenshot
- the after screenshot
- the diff image

Those are not the contract truth, but they are required debugging evidence.

## Binding Rule For Migration Contracts

Any contract in this directory that changes realization while keeping the engine fixed must declare:
- whether byte parity is required
- whether visual parity is required
- which carts are the visual fixtures
- which named regions must match
- which report files prove that match
