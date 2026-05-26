import { spawn } from "child_process";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { HERMES_HOME } from "./installer";

function getConfigPath(profile?: string): string {
  return join(
    profile && profile !== "default"
      ? join(HERMES_HOME, "profiles", profile)
      : HERMES_HOME,
    "config.yaml",
  );
}

function runHermesCmd(args: string[]): Promise<{ success: boolean; error?: string; stdout?: string }> {
  return new Promise((resolve) => {
    try {
      const child = spawn("hermes", args, {
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      });

      let stdout = "";
      let stderr = "";

      child.stdout?.on("data", (chunk: Buffer) => {
        stdout += chunk.toString();
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        stderr += chunk.toString();
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ success: true, stdout: stdout.trim() });
        } else {
          resolve({ success: false, error: (stderr || stdout).trim().substring(0, 500) });
        }
      });

      child.on("error", (err) => {
        resolve({ success: false, error: `Hermes CLI not found: ${err.message}. Please install it first.` });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      resolve({ success: false, error: message });
    }
  });
}

function validateName(name: string): string | null {
  if (!name || !name.trim()) return "Server name is required";
  // Allow alphanumeric, hyphens, underscores, dots
  if (!/^[\w.-]+$/.test(name.trim())) return "Server name contains invalid characters";
  return null;
}

export async function addMcpServer(
  params: { name: string; type: "stdio" | "http"; command?: string; args?: string[]; url?: string },
  profile?: string,
): Promise<{ success: boolean; error?: string }> {
  // Validate
  const nameErr = validateName(params.name);
  if (nameErr) return { success: false, error: nameErr };

  if (params.type === "stdio" && !params.command) {
    return { success: false, error: "Command is required for stdio type" };
  }
  if (params.type === "http" && !params.url) {
    return { success: false, error: "URL is required for HTTP type" };
  }

  // Build args for: hermes mcp add <name> [--command ...] [--args ...] [--url ...]
  const args = ["mcp", "add", params.name.trim()];
  if (params.type === "stdio" && params.command) {
    args.push("--command", params.command);
    if (params.args && params.args.length > 0) {
      args.push("--args", ...params.args);
    }
  }
  if (params.type === "http" && params.url) {
    args.push("--url", params.url);
  }
  if (profile && profile !== "default") {
    args.push("--profile", profile);
  }

  return runHermesCmd(args);
}

export async function removeMcpServer(
  name: string,
  profile?: string,
): Promise<{ success: boolean; error?: string }> {
  const nameErr = validateName(name);
  if (nameErr) return { success: false, error: nameErr };

  const args = ["mcp", "remove", name.trim()];
  if (profile && profile !== "default") {
    args.push("--profile", profile);
  }
  return runHermesCmd(args);
}

/**
 * ⚠️ Toggle MCP server enabled/disabled.
 * hermes CLI has no enable/disable subcommand, so we modify config.yaml directly.
 * This is a minimal text-based approach targeting the server's `enabled:` line.
 */
export function toggleMcpServer(
  name: string,
  enabled: boolean,
  profile?: string,
): { success: boolean; error?: string } {
  const nameErr = validateName(name);
  if (nameErr) return { success: false, error: nameErr };

  try {
    const configPath = getConfigPath(profile);
    if (!existsSync(configPath)) {
      return { success: false, error: "config.yaml not found" };
    }

    let content = readFileSync(configPath, "utf-8");

    // Match the enabled line under mcp_servers.<name>
    // Look for: `  <name>:` then find `    enabled:` in the following lines
    const serverRe = new RegExp(
      `(^ {2}${escapeRegex(name)}:\\s*\\n(?: {4}.+\\n)*? {4})(enabled:\\s*)(true|false)`,
      "m",
    );
    const match = content.match(serverRe);

    if (match) {
      const newValue = enabled ? "true" : "false";
      content =
        content.slice(0, match.index! + match[1].length + match[2].length) +
        newValue +
        content.slice(match.index! + match[1].length + match[2].length + match[3].length);
      writeFileSync(configPath, content, "utf-8");
      return { success: true };
    }

    return { success: false, error: `Server "${name}" not found in config.yaml` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function testMcpServer(
  name: string,
  onOutput: (chunk: string) => void,
): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    try {
      const child = spawn("hermes", ["mcp", "test", name], {
        stdio: ["ignore", "pipe", "pipe"],
        shell: true,
      });

      child.stdout?.on("data", (chunk: Buffer) => {
        onOutput(chunk.toString());
      });

      child.stderr?.on("data", (chunk: Buffer) => {
        onOutput(chunk.toString());
      });

      child.on("close", (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: "Connection test failed" });
        }
      });

      child.on("error", (err) => {
        resolve({ success: false, error: `Hermes CLI not found: ${err.message}. Please install it first.` });
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      resolve({ success: false, error: message });
    }
  });
}
