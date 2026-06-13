# HCC-AUTO-EXECUTOR-AUTH-IMPL-001 — Implementation Round Buglog

- Task: `HCC-AUTO-EXECUTOR-AUTH-IMPL-001`
- Date: 2026-06-13
- Commit: `466e42bb0d0105f20693d211c8d42c8415afceb7`
- Scope: 8 bugs caught and fixed during the implementation round (test suite caught all 8; no user-reported bugs)

---

## Bug 1 — unused `delegate` parameter (TS6133)

- **Error message:** `src/shared/lib/auto-executor/audit-log-boundary.ts(118,3): error TS6133: 'delegate' is declared but its value is never read.`
- **File:** `src/shared/lib/auto-executor/audit-log-boundary.ts`
- **Root cause:** the `createTamperDetector` function declared a `delegate` callback parameter that was never invoked. The original intent (delegate tamper events to a host hook) was not implemented in this round; the parameter was kept for API stability but the TS strict-unused-vars rule flagged it.
- **Fix:** renamed the parameter to `_delegate` (TS convention: leading underscore = intentionally unused) and added a comment noting the parameter is reserved for the future host hook.
- **Tags:** `typescript`, `unused-param`, `audit-boundary`

## Bug 2 — bogus `createWorktreeGuard` import (TS2305)

- **Error message:** `src/shared/lib/auto-executor/boundary.ts(35,10): error TS2305: Module '"./worktree-guard"' has no exported member 'createWorktreeGuard'.`
- **File:** `src/shared/lib/auto-executor/boundary.ts`
- **Root cause:** the boundary composer imported a `createWorktreeGuard` factory that was never written — the `worktree-guard.ts` module exports only the pure function `assertPinnedStateMatches`. The composer was over-designed relative to the underlying module.
- **Fix:** removed the local `createWorktreeGuard` factory in `boundary.ts`; the boundary now constructs `worktreeGuard = { assert: assertPinnedStateMatches }` directly. The interface is preserved (the boundary still exposes `worktreeGuard.assert(...)`), but the unnecessary indirection is gone.
- **Tags:** `typescript`, `over-design`, `boundary-composer`

## Bug 3 — unused `mkdirSync` import (TS6133)

- **Error message:** `src/shared/lib/auto-executor/hermes-write-guard.ts(25,36): error TS6133: 'mkdirSync' is declared but its value is never read.`
- **File:** `src/shared/lib/auto-executor/hermes-write-guard.ts`
- **Root cause:** an early draft of the hermes-write-guard considered creating the hermes home directory on first use; the design pivoted to "guard is validation only, host creates directories" but the import was left behind.
- **Fix:** removed the `mkdirSync` import. The module remains purely validating; directory creation is the host's responsibility.
- **Tags:** `typescript`, `unused-import`, `hermes-guard`

## Bug 4 — `@shared/lib/...` path alias not resolved by web tsconfig

- **Error messages:**
  - `src/shared/lib/auto-executor/audit-log-boundary.ts(24,8): error TS2307: Cannot find module '@shared/lib/safety/types'`
  - `src/shared/lib/auto-executor/secret-accessor.ts(18,41): error TS2307: Cannot find module '@shared/lib/safety/redaction-scanner'`
- **Files:** `audit-log-boundary.ts`, `secret-accessor.ts`
- **Root cause:** the `@shared/*` path alias is configured in `tsconfig.node.json` (which compiles `src/main`, `src/preload`, `src/shared`) but not in `tsconfig.web.json` (which compiles `src/renderer`). The first `typecheck:node` pass succeeded; the second `typecheck:web` pass failed. The shared lib *is* compiled by both configs (it lives in `src/shared`), but the alias only resolves on one side.
- **Fix:** switched the two affected imports to relative paths (`../safety/types`, `../safety/redaction-scanner`). The relative paths resolve identically on both tsconfigs.
- **Tags:** `typescript`, `path-alias`, `tsconfig`, `shared-lib`

## Bug 5 — `|` missing from `SHELL_META` regex (caught by safe-exec test)

- **Error message:** `AssertionError: expected refusal for "a|b": expected true to be false`
- **File:** `src/shared/lib/auto-executor/safe-exec.ts`
- **Root cause:** the shell-metacharacter regex was missing the pipe character `|`. The docstring listed `|` as a forbidden char; the test's "all-metachars" sweep caught the omission. The regex is a one-line set; one character was missed in the read-through.
- **Fix:** added `|` to the character class: `/[;|`$&(){}[\]<>?*!#\\"'\n\r\t\0]/`. While there, also added `~` (Bug 8) so the regex matches the docstring.
- **Tags:** `regex`, `shell-meta`, `safe-exec`, `coverage`

## Bug 6 — `hermesHome` not realpath'd at construction (macOS symlink)

- **Error message:** `AssertionError: expected false to be true` on tests that wrote under the hermes home.
- **File:** `src/shared/lib/auto-executor/hermes-write-guard.ts`
- **Root cause:** the guard stored the `hermesHome` config value as `resolve(...)` (a syntactic resolve) but did not realpath it. On macOS, `/tmp` resolves to `/private/tmp` and `/var/folders/...` to `/private/var/folders/...`. The test's hermes home was `/var/folders/...`; `safeRealpath` on the target resolved to `/private/var/folders/...`; the prefix check `resolved.startsWith(hermesHome + sep)` failed because the stored `hermesHome` was the unresolved form.
- **Fix:** added a `safeRealpathStatic` helper and called it on the `hermesHome` at construction time. The guard's notion of "home" is now consistent with `safeRealpath`'s notion of "resolved". Also made `mintToken` realpath its `path` argument so a token minted by one guard is verifiable by another guard constructed against the same home, regardless of minor realpath variance.
- **Tags:** `realpath`, `macos`, `symlink`, `hermes-guard`, `preflight-gate-failure`

## Bug 7 — `dryRun: true` on boundary's kill switch made `abort()` not actually abort

- **Error message:** `AssertionError: expected false to be true` — `killSwitch.isKilled()` was `false` after `boundary.abort()`.
- **File:** `src/shared/lib/auto-executor/boundary.ts`
- **Root cause:** the boundary composer's `createKillSwitch({ dryRun: true })` call left the kill switch in a mode that records the reason but does not call `controller.abort()`. The boundary is the **runtime side**, not the dry-run side; `dryRun: true` was a misguided "safety" default that broke the only behavior the boundary needs from its kill switch. The dry-run flag is still available on the standalone `createKillSwitch()` for callers that need it.
- **Fix:** removed `dryRun: true` from the boundary's kill switch construction. The standalone `createKillSwitch({ dryRun: true })` continues to exist for tests of the kill switch alone.
- **Tags:** `kill-switch`, `boundary-composer`, `dry-run`, `default-state`

## Bug 8 — `~` missing from `SHELL_META` regex (caught by safe-exec test)

- **Error message:** `AssertionError: expected refusal for "~": expected true to be false`
- **File:** `src/shared/lib/auto-executor/safe-exec.ts`
- **Root cause:** same class of bug as #5. The docstring listed `~` as a forbidden char; the regex omitted it. POSIX shell expands `~` to `$HOME` at the start of a word in some contexts; refusing it is the safer default.
- **Fix:** added `~` to the character class (same edit as Bug 5).
- **Tags:** `regex`, `shell-meta`, `safe-exec`, `coverage`

---

## Summary

| # | Class | Caught by | Time to fix |
|---|---|---|---|
| 1 | TS unused param | `npm run typecheck` | 1 min |
| 2 | TS over-design | `npm run typecheck` | 1 min |
| 3 | TS unused import | `npm run typecheck` | 30 sec |
| 4 | TS path alias | `npm run typecheck` (web pass) | 1 min |
| 5 | regex coverage | `npx vitest run tests/auto-executor/audit-safe-exec.test.ts` | 30 sec |
| 6 | macOS realpath | `npx vitest run tests/auto-executor/secrets-hermes-boundary.test.ts` | 5 min (incl. mintToken follow-up) |
| 7 | boundary dryRun | `npx vitest run tests/auto-executor/secrets-hermes-boundary.test.ts` | 1 min |
| 8 | regex coverage (cont.) | `npx vitest run tests/auto-executor/audit-safe-exec.test.ts` | 30 sec |

**All 8 caught before commit. None reached `origin`.**

**Empirical evidence that the test suite works as a gate:**
- 4/8 caught by `typecheck` (would have made `npm run build` fail)
- 4/8 caught by `vitest` (would have made `npm test` fail)
- 0/8 caught by human review of the diff alone

**Process note:** the round was the right shape. Typecheck and vitest are complementary: TS catches structural errors; vitest catches behavioral errors. Neither is sufficient alone.
