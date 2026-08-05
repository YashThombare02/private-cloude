---
name: Orval zod codegen requires zod v4
description: pnpm-workspace catalog zod pin must match the zod major version orval's zod client generates for, or lib/api-zod typecheck fails.
---

Orval v8.x's `zod` client output uses zod v4-only top-level shorthands (`z.int()`, `z.url()`, etc.) in
`lib/api-zod/src/generated/api.ts`, regardless of what zod version is installed. If the pnpm-workspace
catalog pins `zod` to a v3 release (e.g. `^3.25.76`), `pnpm --filter @workspace/api-spec run codegen`
generates code that fails `tsc --build` with `Property 'int' does not exist on type ...zod/index'`.

**Why:** The catalog entry can drift out of sync with the orval version's expected zod target. `replit.md`
documents the project as using `zod/v4`, confirming v4 is the intended version — the v3 pin was stale.

**How to apply:** If `api-spec` codegen's typecheck step fails with missing `.int()`/`.url()` (or similar
v4-only methods) on the `zod` namespace, bump the `zod` entry in `pnpm-workspace.yaml`'s `catalog:` block to
a `^4.x` release, run `pnpm install`, then re-run codegen. `drizzle-zod` (`^0.8.3`+) supports both
`zod@^3.25.0` and `zod@^4.0.0` as peers, so this does not conflict with Drizzle schema validators.
