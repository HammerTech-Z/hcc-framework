import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { profileHome, safeWriteFile } from "./utils";

function canonicalSoulPath(profile?: string): string {
  const home = profileHome(profile);
  const hermesSoul = join(home, "HERMES-SOUL.md");
  if (existsSync(hermesSoul)) return hermesSoul;
  const soul = join(home, "SOUL.md");
  if (existsSync(soul)) return soul;
  return "";
}

const DEFAULT_SOUL = `You are Hermes, a helpful AI assistant. You are friendly, knowledgeable, and always eager to help.

You communicate clearly and concisely. When asked to perform tasks, you think step-by-step and explain your reasoning. You are honest about your limitations and ask for clarification when needed.

You strive to be helpful while being safe and responsible. You respect the user's privacy and handle sensitive information carefully.
`;

export function readSoul(profile?: string): string {
  const canonical = canonicalSoulPath(profile);
  if (!canonical) return DEFAULT_SOUL;

  try {
    return readFileSync(canonical, "utf-8");
  } catch {
    return DEFAULT_SOUL;
  }
}

export function writeSoul(content: string, profile?: string): boolean {
  const canonical = canonicalSoulPath(profile);
  // Write to whichever file exists (HERMES-SOUL.md first, else SOUL.md)
  const target = canonical || join(profileHome(profile), "SOUL.md");

  try {
    safeWriteFile(target, content);
    return true;
  } catch {
    return false;
  }
}

export function resetSoul(profile?: string): string {
  // resetSoul follows the same canonical path as writeSoul:
  // - If HERMES-SOUL.md exists, reset it (after backup)
  // - Else if SOUL.md exists, reset it (after backup)
  // - Else create SOUL.md
  const home = profileHome(profile);
  const hermesSoul = join(home, "HERMES-SOUL.md");
  const soul = join(home, "SOUL.md");

  let target: string;
  if (existsSync(hermesSoul)) {
    target = hermesSoul;
  } else if (existsSync(soul)) {
    target = soul;
  } else {
    target = soul; // create SOUL.md as fallback
  }

  try {
    // Backup existing file before overwriting
    if (existsSync(target)) {
      const backupPath = `${target}.bak.v5-ui-content.${Date.now()}`;
      safeWriteFile(backupPath, readFileSync(target, "utf-8"));
    }
    safeWriteFile(target, DEFAULT_SOUL);
    return DEFAULT_SOUL;
  } catch {
    return DEFAULT_SOUL;
  }
}
