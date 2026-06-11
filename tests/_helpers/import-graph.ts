/**
 * Import-graph helper — UI-SAFETY-001 (2026-06-11).
 *
 * Traces the transitive import graph of a given entry module using TypeScript's
 * compiler API. Intended for read-only view boundary tests that must verify no
 * forbidden API (ipcRenderer, fetch, window.hermesAPI, etc.) reaches the view
 * surface through any imported module — something string-based scanning cannot
 * catch when the forbidden call is behind a helper/wrapper.
 *
 * Dependencies: typescript (devDependency), node:fs, node:path, node:module.
 * No new packages. No runtime code. No IPC.
 */

import { createRequire } from "module";
import { existsSync, readFileSync } from "fs";
import { dirname, extname, resolve } from "path";

const projectRequire = createRequire(import.meta.url ?? __dirname);
const ts: typeof import("typescript") = projectRequire("typescript");

const PROJECT_ROOT = resolve(__dirname, "..", "..");
const SRC = resolve(PROJECT_ROOT, "src");

/** Path alias map (from vitest.config.ts) */
const PATH_ALIASES: Record<string, string> = {
  "@renderer/": resolve(PROJECT_ROOT, "src", "renderer", "src") + "/",
  "@shared/": resolve(PROJECT_ROOT, "src", "shared") + "/",
};

const FORBIDDEN_RE =
  /\b(ipcRenderer\s*\.\s*invoke|window\s*\.\s*hermesAPI\s*\.\s*\w+\s*\(|fetch\s*\()/;

class ImportGraphError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportGraphError";
  }
}

function resolveImport(
  specifier: string,
  fromFile: string,
): string | null {
  // Skip external / node_modules / CSS imports
  if (
    !specifier.startsWith(".") &&
    !specifier.startsWith("@renderer/") &&
    !specifier.startsWith("@shared/") &&
    !specifier.startsWith("@/")
  ) {
    return null;
  }

  const fromDir = dirname(fromFile);

  // Path aliases
  for (const [alias, aliasRoot] of Object.entries(PATH_ALIASES)) {
    if (specifier.startsWith(alias)) {
      const rel = specifier.slice(alias.length);
      return resolveWithExt(resolve(aliasRoot, rel));
    }
  }

  // Relative imports
  if (specifier.startsWith(".")) {
    return resolveWithExt(resolve(fromDir, specifier));
  }

  return null;
}

function resolveWithExt(absolute: string): string | null {
  // Already has extension
  if (extname(absolute)) {
    if (existsSync(absolute)) return absolute;
    // Try index file in directory
    if (existsSync(resolve(absolute, "index.ts"))) return resolve(absolute, "index.ts");
    if (existsSync(resolve(absolute, "index.tsx"))) return resolve(absolute, "index.tsx");
    return null;
  }

  for (const ext of [".ts", ".tsx"]) {
    const candidate = absolute + ext;
    if (existsSync(candidate)) return candidate;
  }

  // Try as directory with index file
  for (const ext of [".ts", ".tsx"]) {
    const candidate = resolve(absolute, "index" + ext);
    if (existsSync(candidate)) return candidate;
  }

  return null;
}

/**
 * Returns the set of absolute paths of all modules transitively imported
 * by `entryModule`, starting from and including the entry module itself.
 *
 * The entry module must be an absolute path. Relative imports, path aliases
 * (`@renderer/*`), and directory/index files are resolved. External packages
 * and node_modules are skipped.
 *
 * Circular imports are handled (each module is visited at most once).
 */
export function getTransitiveImports(entryModule: string): Set<string> {
  if (!existsSync(entryModule)) {
    throw new ImportGraphError(`Entry module not found: ${entryModule}`);
  }

  const visited = new Set<string>();
  const queue: string[] = [entryModule];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    let sourceText: string;
    try {
      sourceText = readFileSync(current, "utf-8");
    } catch {
      continue; // skip unreadable files
    }

    const sourceFile = ts.createSourceFile(
      current,
      sourceText,
      ts.ScriptTarget.Latest,
      /* setParentNodes */ false,
    );

    // Recursive walk over the entire AST (not just top-level statements).
    // `ts.forEachChild` only descends one level, so imports nested inside
    // function bodies, class methods, IIFEs, dynamic dispatch tables, etc.
    // would be missed. We must traverse every node to catch:
    //   - require("./foo") wrapped in a function
    //   - import("./foo") inside an async method
    //   - ExportDeclaration re-exporting a forbidden module from a helper
    //   - any other indirection that hides the import at the top level
    walkAll(sourceFile, (node) => {
      // Static import: `import ... from "..."`
      if (ts.isImportDeclaration(node)) {
        const specifier = (node.moduleSpecifier as { text?: string }).text;
        if (!specifier) return;
        enqueueIfLocal(specifier, current, queue, visited);
        return;
      }

      // Re-export: `export ... from "..."` (the audit's "wrapper indirection"
      // attack — wrapper re-exports a forbidden module, hiding the call).
      if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
        const specifier = (node.moduleSpecifier as { text?: string }).text;
        if (!specifier) return;
        enqueueIfLocal(specifier, current, queue, visited);
        return;
      }

      // Dynamic import: `import("...")` — detect by expression kind rather
      // than relying on a guard that may not be present on all TS versions.
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        const inner = ts.isStringLiteral(node.arguments[0])
          ? node.arguments[0].text
          : null;
        if (inner) enqueueIfLocal(inner, current, queue, visited);
        return;
      }

      // CommonJS require: `require("...")` — also catches
      // `function go() { return require("./foo") }` and similar.
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        if (node.expression.text === "require" && node.arguments.length > 0) {
          const arg = node.arguments[0];
          if (ts.isStringLiteral(arg)) {
            enqueueIfLocal(arg.text, current, queue, visited);
          }
        }
      }
    });
  }

  return visited;
}

/**
 * Recursive AST walker. Calls `visit` for every node in the tree, then
 * recurses into all children via `ts.forEachChild`. This is necessary
 * because `ts.forEachChild` is a one-level visitor, not a deep one — and
 * import statements can be nested at any depth (function bodies, IIFEs,
 * class methods, dynamic dispatch tables, etc.).
 */
function walkAll(
  node: ts.Node,
  visit: (n: ts.Node) => void,
): void {
  visit(node);
  ts.forEachChild(node, (child) => walkAll(child, visit));
}

function enqueueIfLocal(
  specifier: string,
  fromFile: string,
  queue: string[],
  visited: Set<string>,
): void {
  const resolved = resolveImport(specifier, fromFile);
  if (resolved && !visited.has(resolved)) {
    queue.push(resolved);
  }
}

/**
 * For a given read-only view (identified by its enforcement level in the
 * contract), assert that no module in its transitive import graph contains
 * forbidden API call forms.
 *
 * `entryModule` should be the absolute path to the screen component file.
 */
export function assertImportGraphClean(
  entryModule: string,
  options?: { skipEntry?: boolean },
): void {
  const modules = getTransitiveImports(entryModule);

  for (const mod of modules) {
    if (options?.skipEntry && mod === entryModule) continue;

    const src = readFileSync(mod, "utf-8");

    // Skip .d.ts declaration files — they cannot contain runtime calls
    if (mod.endsWith(".d.ts")) continue;

    // Skip files outside the project src/
    if (!mod.startsWith(SRC + "/")) continue;

    if (FORBIDDEN_RE.test(src)) {
      const match = src.match(FORBIDDEN_RE);
      throw new ImportGraphError(
        `Import-graph violation in ${mod}: ` +
          `contains forbidden API call \`${match?.[0]?.trim()}\`. ` +
          `This module is transitively imported by ${entryModule}. ` +
          `Read-only views must not import any module that uses ipcRenderer.invoke, ` +
          `window.hermesAPI.*, or fetch().`,
      );
    }
  }
}

export { FORBIDDEN_RE, ImportGraphError };
