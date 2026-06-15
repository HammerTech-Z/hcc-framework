#!/usr/bin/env node
// HCC Unattended Terminal CLI launcher.
//
// Thin Node ESM wrapper. Dynamic-imports the bundled CLI at
// `out/cli/hcc-unattended-terminal.mjs` (produced by
// `esbuild --bundle --format=esm --platform=node --target=node20`
// from `src/cli/hcc-unattended-terminal.ts`) and invokes its
// `main()` function with `process.argv.slice(2)`.
//
// The CLI source is bundled so the wrapper does not need a
// Node 24 module-resolver hook. The bundled file has all
// transitive imports inlined and is pure ESM JavaScript.
//
// Usage:
//   node bin/hcc-unattended-terminal.mjs \
//     --terminal-agent-session-id <id> \
//     --terminal-invocation-id <id> \
//     --explicit-unattended-trigger-token <token> \
//     --feature-flag-enabled \
//     --task-id <id> \
//     --source-plan-ref <ref> \
//     --requested-by-user <id> \
//     --authorization-id <id> \
//     --schedule-id <id> \
//     --planned-action-id <id> \
//     --planned-action-kind <shell_command|file_write|config_patch> \
//     --target-path <path>
//
// Exit codes:
//   - 0 — TERMINAL-UNATTENDED-SCHEDULED-DISPATCHED
//   - 2 — NO-GO (parse error, missing flag, scheduler NO-GO,
//          or entrypoint NO-GO)
//
// Red lines honored:
//   - no `setInterval` / `setTimeout` / `setImmediate`
//   - no `spawn` / `exec` / `child_process`
//   - no `submitDryRunAction`
//   - no `auto-executor-bootstrap|arm|start|host` imports
//   - no `~/.hermes/**` writes
//   - no `package.json` / `package-lock.json` change
//
// The bundled file at `out/cli/hcc-unattended-terminal.mjs` is
// produced by a local `esbuild` invocation. The `out/` directory
// is gitignored; the bundled file is NOT committed.

import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";
import { existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const bundledPath = pathResolve(
  __dirname,
  "..",
  "out",
  "cli",
  "hcc-unattended-terminal.mjs",
);

if (!existsSync(bundledPath)) {
  process.stdout.write(
    JSON.stringify(
      {
        schema_version: "1.0.0",
        verdict: "NO-GO",
        reason: `hcc-unattended-terminal: bundled CLI not found at ${bundledPath}. Run: npx esbuild src/cli/hcc-unattended-terminal.ts --bundle --format=esm --platform=node --target=node20 --outfile=out/cli/hcc-unattended-terminal.mjs`,
      },
      null,
      2,
    ) + "\n",
  );
  process.exit(2);
}

const bundledURL = pathToFileURL(bundledPath).href;
const mod = await import(bundledURL);
const code = await mod.main(process.argv.slice(2));
process.exit(code);
