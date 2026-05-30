# Hermes Pro Fix Plan - 2026-05-30

Source documents checked locally:

- `/Users/midoudou/Desktop/Hermes-Pro-Codex任务规格.md`
- `/Users/midoudou/Desktop/Hermes-Pro-全量审计报告-2026-05-30.md`
- `/Users/midoudou/Desktop/Hermes-Pro的claude网页版审查报告.docx`

This plan records what the repo itself confirmed, not just the audit claims.

## Confirmed Findings

### SEC-1 Webview

- `src/main/index.ts` had `webviewTag: true`.
- `src/renderer/src/screens/Office/Office.tsx` uses exactly one `<webview>` for Claw3D.
- `src/main/security.ts` already removed `preload` and `preloadURL` during attach, and already enforced `nodeIntegration=false`, `contextIsolation=true`, `sandbox=true`, `webSecurity=true`.
- Real gap: webview URL policy allowed any loopback HTTP port from 1024 to 65535. The actual app-controlled use case is the configured Claw3D port.
- Real gap: attached webviews did not have their own `will-navigate` / popup policy bound after attachment.

Fix applied:

- `isAllowedWebviewUrl` now requires an explicit allowed port list.
- Main process allows the current Claw3D port only.
- Attached webview contents now block navigation and popups unless the target remains on the allowed Claw3D webview URL.
- Security tests cover exact-port allowlisting and malicious preload removal.

### SEC-3 Markdown / Snippet XSS

- `AgentMarkdown.tsx` uses `react-markdown` with `remarkGfm` only.
- No `rehype-raw` / `rehypeRaw` was found.
- Agent markdown rendering does not use `dangerouslySetInnerHTML`.
- `Sessions.highlightSnippet` builds React text nodes and `<mark>` elements; it does not inject HTML.

Current decision:

- No code change needed for this item.
- Keep future changes from adding raw HTML rendering unless paired with sanitization tests.

### SEC-4 External URL Policy

- `isAllowedExternalUrl` previously allowed the whole `vscode:` scheme.
- Real gap: `vscode://extension/...` and other deep links should not be treated like normal browser-safe external URLs.

Fix applied:

- `vscode:` is allowed only for the `vscode://file/...` action.
- The policy rejects query-bearing links, malformed links, NULs, and path traversal before URL normalization can hide `..`.
- Tests cover good file links and blocked extension / traversal / query links.

### BLM-1 BaiLongma Error Classification

- `BaiLongma.tsx` had four broad classes: `rate_limited`, `permission_required`, `connection_failed`, `unknown`.
- Real gap: 5xx, client errors, timeouts, connection refused, TLS failures, auth expiry, permission denial, and delivery failures were conflated.
- Real gap: retryability was not represented.

Fix applied:

- Error classification is now a pure module.
- New classes: `server_error`, `client_error`, `timeout`, `connection_refused`, `tls_error`, `auth_expired`, `permission_denied`, `delivery_failed`.
- Each classification includes `retryable`.
- The BaiLongma UI shows retryable/manual status without adding IPC or write behavior.
- Tests cover every classification.

## Deferred Until Safer Preconditions Exist

### SEC-2 IPC Surface Segmentation

The preload exposes a broad `hermesAPI` surface. This is real risk, but removing methods safely requires a usage matrix and page-level bridge split. Do not do a blind deletion pass.

Next executable step:

1. Generate `docs/security/ipc-surface.md` from `src/preload/index.ts`.
2. Mark each API by domain and risk.
3. Grep renderer call sites before removing or gating anything.
4. Add path traversal tests for handlers that accept file paths.

### PY-1 / PY-2 Agent `main.py`

The Python agent refactor should not start until golden transcript tests exist in `~/.hermes/hermes-agent/`. The desktop test suite does not protect that core loop.

Next executable step:

1. Map the top-level structure of `hermes_cli/main.py`.
2. Add golden transcript replay tests.
3. Only then extract leaf modules.

### CSS-1 Full CSS Audit

This pass added only the missing BaiLongma classes created by the error taxonomy change. The full 99-missing-class cleanup should be a separate visual QA task.

### LLM Router / Memory Guardrails

The audit concern is credible, but it needs measurement and config design before code changes:

1. Establish a conservative local context hard limit.
2. Add local/cloud routing and fallback state.
3. Record telemetry for local model OOM, timeout, and tool-call parse failures.
