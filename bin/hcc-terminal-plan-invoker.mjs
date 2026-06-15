#!/usr/bin/env node
/**
 * HCC Terminal Plan Invoker — bin wrapper.
 *
 * Dynamically loads the esbuild-bundled CLI module from
 * `out/cli/hcc-terminal-plan-invoker.mjs`. If the bundle is
 * missing, prints a typed NO-GO and instructs the user to
 * build it.
 *
 * Usage:
 *   node bin/hcc-terminal-plan-invoker.mjs \
 *     --plan-fixture <path> \
 *     --terminal-agent-session-id <id> \
 *     --terminal-invocation-id <id> \
 *     --explicit-user-trigger-token <token> \
 *     --feature-flag-enabled
 *
 * This wrapper does NOT perform any dispatch, spawn, exec,
 * or I/O beyond loading the bundle and delegating.
 */

import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");
const BUNDLE_PATH = resolve(
  REPO_ROOT,
  "out",
  "cli",
  "hcc-terminal-plan-invoker.mjs",
);

const NO_GO_TEMPLATE = {
  schema_version: "1.0.0",
  verdict: "NO-GO",
  reason: "",
  terminal_agent_session_id: "",
  terminal_invocation_id: "",
  task_id: "",
  planned_action_id: "",
  unattended_ready: false,
  night_run_ready: false,
  go_no_go: "NO-GO",
};

if (!existsSync(BUNDLE_PATH)) {
  const err = {
    ...NO_GO_TEMPLATE,
    reason:
      "bundle missing at out/cli/hcc-terminal-plan-invoker.mjs. Run: npx esbuild src/cli/hcc-terminal-plan-invoker.ts --bundle --format=esm --platform=node --target=node20 --outfile=out/cli/hcc-terminal-plan-invoker.mjs",
  };
  process.stdout.write(JSON.stringify(err, null, 2) + "\n");
  process.exit(2);
}

try {
  const mod = await import(BUNDLE_PATH);
  if (typeof mod.main !== "function") {
    const err = {
      ...NO_GO_TEMPLATE,
      reason:
        "bundle at out/cli/hcc-terminal-plan-invoker.mjs does not export main()",
    };
    process.stdout.write(JSON.stringify(err, null, 2) + "\n");
    process.exit(2);
  }
  const code = await mod.main(process.argv.slice(2));
  process.exit(code);
} catch (err) {
  const errOut = {
    ...NO_GO_TEMPLATE,
    reason: `bin wrapper error: ${(err as Error).message ?? String(err)}`,
  };
  process.stdout.write(JSON.stringify(errOut, null, 2) + "\n");
  process.exit(2);
}
