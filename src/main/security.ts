import type { WebPreferences } from "electron";
import { pathToFileURL } from "url";

const EXTERNAL_PROTOCOLS = new Set(["https:", "http:", "mailto:"]);
const LOCAL_WEBVIEW_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

type WebviewPreferences = WebPreferences & {
  preloadURL?: string;
};

function parseUrl(rawUrl: unknown): URL | null {
  if (typeof rawUrl !== "string") return null;
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
}

export function isAllowedExternalUrl(rawUrl: unknown): rawUrl is string {
  const url = parseUrl(rawUrl);
  if (!url) return false;
  if (EXTERNAL_PROTOCOLS.has(url.protocol)) return true;
  return isAllowedVscodeUrl(url, rawUrl);
}

function hasPathTraversal(rawUrl: string): boolean {
  let decoded: string;
  try {
    decoded = decodeURIComponent(rawUrl);
  } catch {
    return true;
  }
  return decoded.split(/[\\/]+/).includes("..");
}

function isAllowedVscodeUrl(url: URL, rawUrl: unknown): boolean {
  if (url.protocol !== "vscode:") return false;
  if (typeof rawUrl !== "string" || hasPathTraversal(rawUrl)) return false;
  if (url.hostname !== "file") return false;
  if (url.username || url.password || url.search) return false;

  let filePath: string;
  try {
    filePath = decodeURIComponent(url.pathname);
  } catch {
    return false;
  }

  if (!filePath || filePath.includes("\0")) return false;
  if (!filePath.startsWith("/")) return false;
  if (filePath.split("/").includes("..")) return false;

  return filePath.length > 1;
}

export function isAllowedAppNavigationUrl(
  rawUrl: unknown,
  rendererHtmlPath: string,
  devServerUrl?: string,
): rawUrl is string {
  const url = parseUrl(rawUrl);
  if (!url) return false;

  const devServer = parseUrl(devServerUrl);
  if (devServer) {
    return url.origin === devServer.origin;
  }

  const rendererUrl = pathToFileURL(rendererHtmlPath);
  return (
    url.protocol === "file:" && url.href.split("#")[0] === rendererUrl.href
  );
}

export function isAllowedWebviewUrl(
  rawUrl: unknown,
  allowedPorts: Iterable<number>,
): rawUrl is string {
  const url = parseUrl(rawUrl);
  if (!url || url.protocol !== "http:") return false;
  if (!LOCAL_WEBVIEW_HOSTS.has(url.hostname)) return false;

  const port = Number(url.port);
  if (!Number.isInteger(port)) return false;
  return new Set(allowedPorts).has(port);
}

export function hardenWebviewPreferences(
  webPreferences: WebviewPreferences,
): void {
  delete webPreferences.preload;
  delete webPreferences.preloadURL;
  webPreferences.nodeIntegration = false;
  webPreferences.contextIsolation = true;
  webPreferences.sandbox = true;
  webPreferences.webSecurity = true;
  webPreferences.allowRunningInsecureContent = false;
}
