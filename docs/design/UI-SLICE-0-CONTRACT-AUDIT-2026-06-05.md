# UI Slice 0 — Contract Audit (2026-06-05)

> Status: AUDIT ONLY. No renderer/src/preload/main changes. No IPC added.
> Trigger: Spec approval commits `411954b` + `e171213` (2026-06-04/05).
> Goal: enumerate every screen, every IPC, classify read/write/runtime/external, gate Slice 1.
> Output: this document. Run report at `~/.hermes/pipeline-runs/HCC-20260605-UI-SLICE-0-CONTRACT-AUDIT/01-report.md`.
> Ground truth: `docs/design/UI-GROUND-TRUTH-2026-06-04.md` (no factual drift detected — see §6).
> Spec: `docs/design/HERMES-PRO-UI-DESIGN-SPEC-2026-06-04.md`.

---

## 1. Screen Inventory

27 screen files in `src/renderer/src/screens/`. App.tsx drives 5 top-level phases: splash / welcome / installing / setup / main. Layout.tsx drives 18 main-app views.

| # | View / Route | Screen file | Purpose | Data source | IPC calls | Class | Slice readiness | Notes |
|---|---|---|---|---|---|---|---|---|
| S-01 | splash | `SplashScreen/SplashScreen.tsx` | Brand animation while install check runs | none | none | read-only | S0+ | Cosmetic; SPA mask; min 1300ms |
| S-02 | welcome | `Welcome/Welcome.tsx` | First-run / broken-install landing, connection setup | local connection config | `getConnectionConfig`, `testRemoteConnection`, `testSshConnection`, `setConnectionConfig`, `setSshConfig` | writes-config (read+test before write) | S2+ | SSH-tunnel start gated; pre-`main` |
| S-03 | installing | `Install/Install.tsx` | Installer progress UI | `onInstallProgress` stream | `onInstallProgress` | external-action (installs Python+hermes) | S2+ | Heavy; only via Install route, not in main shell |
| S-04 | setup | `Setup/Setup.tsx` | API key entry, model config on first run | env, model config | `setEnv`, `setModelConfig`, `openExternal` | writes-config + external | S2+ | One-time; pre-`main` |
| S-05 | main.chat | `Chat/Chat.tsx` | Default conversation home | streaming chat, slash menu, model picker | `sendMessage`, `abortChat`, `onChatChunk`, `onChatDone`, `onChatError`, `onChatToolProgress`, `onChatUsage`, `getModelConfig`, `setModelConfig`, `listModels`, `getConfig`, `setConfig`, `getHermesVersion`, `getAppVersion`, `getToolsets`, `listInstalledSkills`, `readMemory`, `readSoul` | runtime-action (sends to Hermes agent) + writes-config (model picker) | S3 | Reference for S6.1; voice entry **MUST** be inert |
| S-06 | main.sessions | `Sessions/Sessions.tsx` | Session list (cached + searched) | local cache, gateway search | `listCachedSessions`, `syncSessionCache`, `searchSessions` | read-only (+ sync triggers gateway read) | S2+ | No replay from UI; resume navigates to Chat |
| S-07 | main.agents | `Agents/Agents.tsx` | Profile list, create/delete, set active | profiles dir | `listProfiles`, `createProfile`, `deleteProfile`, `setActiveProfile` | writes-config (active) + writes-data (profile create/delete) | S2+ | Heaviest writes in main shell |
| S-08 | main.office | `Office/Office.tsx` | Claw3D companion UI (port, dev server, adapter, logs) | claw3d subsystem | `claw3dStatus`, `claw3dSetup`, `claw3dGetPort`, `claw3dSetPort`, `claw3dGetWsUrl`, `claw3dSetWsUrl`, `claw3dStartAll`, `claw3dStopAll`, `claw3dGetLogs`, `claw3dStartDev`, `claw3dStopDev`, `claw3dStartAdapter`, `claw3dStopAdapter`, `onClaw3dSetupProgress`, `openExternal` | runtime-action + external-action | S2+ | Has `openExternal`; **MUST** keep separate preference pane in S6 |
| S-09 | main.models | `Models/Models.tsx` | Saved model list, add/remove/update | `models` registry | `listModels`, `addModel`, `removeModel`, `updateModel`, `setEnv` | writes-data | S6 | Settings pane in redesign |
| S-10 | main.providers | `Providers/Providers.tsx` | API key pool, provider env, model defaults | `credential-pool` + env | `getCredentialPool`, `setCredentialPool`, `getEnv`, `setEnv`, `getModelConfig`, `setModelConfig`, `addModel` | writes-config (sensitive — keys) | S6 | Preference pane; secrets handling must stay intact |
| S-11 | main.skills | `Skills/Skills.tsx` | Bundled + installed skills, install/uninstall | `~/.hermes/skills/` | `listBundledSkills`, `listInstalledSkills`, `getSkillContent`, `installSkill`, `uninstallSkill` | writes-data (filesystem) | S6 | Install/uninstall write filesystem |
| S-12 | main.soul | `Soul/Soul.tsx` | Persona (SOUL.md) editor | `~/.hermes/profiles/<p>/SOUL.md` | `readSoul`, `writeSoul`, `resetSoul` | writes-data (persona) | S6 | Reset rewrites default |
| S-13 | main.memory | `Memory/Memory.tsx` | Memory entries, user profile, providers | `~/.hermes/profiles/<p>/memory.md` + env | `readMemory`, `addMemoryEntry`, `updateMemoryEntry`, `removeMemoryEntry`, `writeUserProfile`, `discoverMemoryProviders`, `getEnv`, `setEnv`, `setConfig`, `getConfig`, `openExternal` | writes-data (memory) + writes-config | S6 | Multiple write IPCs |
| S-14 | main.tools | `Tools/Tools.tsx` | Toolset enable/disable, MCP servers | toolset config + MCP registry | `getToolsets`, `setToolsetEnabled`, `listMcpServers` | writes-config | S6 | MCP display only; toggle writes config |
| S-15 | main.schedules | `Schedules/Schedules.tsx` | Cron jobs CRUD + trigger | cron subsystem | `listCronJobs`, `createCronJob`, `removeCronJob`, `pauseCronJob`, `resumeCronJob`, `triggerCronJob` | writes-data (cron) + runtime-action (triggerCronJob) | S6 | `triggerCronJob` is a runtime-action — keep visible label "Manual trigger" with confirm |
| S-16 | main.gateway | `Gateway/Gateway.tsx` | Gateway start/stop, env, platform toggles | gateway subsystem | `startGateway`, `stopGateway`, `gatewayStatus`, `getEnv`, `setEnv`, `getPlatformEnabled`, `setPlatformEnabled` | runtime-action (start/stop) + writes-config | S6 | Mission Control later consolidates this view |
| S-17 | main.monitor | `AgentMonitor/index.tsx` | Gateway state, vault listing, cron history, events, pipeline runs, **playbook execution stream** (read-only) | gateway + cron + events | `getGatewayState`, `listVaultFiles`, `getCronJobHistory`, `getEvents`, `listPipelineRuns`, `checkGatewayHealth`, `listCachedSessions`, `onPlaybookStep`, `onPlaybookDone`, `onPlaybookError` | read-only (subscribes to playbook events but does not invoke `runPlaybook`) | S2+ | Sits between read-only and runtime-action due to playbook event subscription; safe |
| S-18 | main.playbooks | `Playbooks/Playbooks.tsx` → `components/PlaybookRunner` | Playbook runner UI | playbooks registry | (delegated to `components/PlaybookRunner`) | runtime-action (playbook run) | S6 | Stub wrapping; see also `Understand` which calls `runPlaybook` directly |
| S-19 | main.understand | `Understand/Understand.tsx` | "Understand Anything" feature, history viewer, **can launch `runPlaybook`** | understanding dir + playbooks | `understandAnything`, `listUnderstandingHistory`, `readUnderstandingHistory`, `runPlaybook` | writes-data (history) + runtime-action (`runPlaybook`) | S6 | `runPlaybook` call on the "Run Playbook" button is the primary risk — **MUST** retain explicit confirm + visible HCC dry-run state |
| S-20 | main.bailongma | `BaiLongma/BaiLongma.tsx` | Read-only cockpit (P0–P3.5 stage bar, gateway, vault, GBrain, usage feedback, risks, next actions, pipeline artifacts, cron summary, event log) | gateway + vault + events | `getGatewayState`, `listVaultFiles`, `listPipelineRuns`, `getEvents`, `listCronJobs` | read-only | S4 | Reference for Mission Control; rename to `mission` in S4 |
| S-21 | main.hccCockpit | `HccCockpit/HccCockpit.tsx` | HCC-specific cockpit (runs, playbooks list, cron history, events, gateway, health) | hcc subsystem | `listPipelineRuns`, `listPlaybooks`, `getCronJobHistory`, `getEvents`, `getGatewayState`, `checkGatewayHealth` | read-only (display only — `listPlaybooks` enumerates, does not invoke) | S4 | HccCockpit overlaps with BaiLongma; S4 will fold into Mission Control |
| S-22 | main.settings | `Settings/Settings.tsx` | App settings, connection, MCP, install/backup/import | config + connection + mcp | `getAppVersion`, `getConfig`, `setConfig`, `getHermesHome`, `getHermesVersion`, `refreshHermesVersion`, `getConnectionConfig`, `setConnectionConfig`, `setSshConfig`, `testRemoteConnection`, `testSshConnection`, `listMcpServers`, `addMcpServer`, `removeMcpServer`, `toggleMcpServer`, `testMcpServer`, `onMcpTestOutput`, `onMcpTestDone`, `onMcpTestError`, `onInstallProgress`, `runHermesDoctor`, `runHermesUpdate`, `runClawMigrate`, `runHermesBackup`, `runHermesImport`, `runHermesDump`, `readLogs` | writes-config (most) + writes-data (MCP add/remove) + external-action (backup/import/doctor/update/migrate) | S6 | Largest surface; redesign in S6 as preference pane |
| S-23 | n/a (Layout) | `Layout/Layout.tsx` | App shell, nav, pane router, update flow, menu hooks | `visitedViews` (in-memory) + session list | `getSessionMessages`, `isRemoteOnlyMode`, `onUpdateAvailable`, `onUpdateDownloadProgress`, `onUpdateDownloaded`, `downloadUpdate`, `installUpdate`, `abortChat`, `onMenuNewChat`, `onMenuSearchSessions` | read-only + external (update flow) | S2 | Update flow + nav are the most-touched areas |
| S-24 | n/a (App) | `App.tsx` | Top-level phase router (splash/welcome/install/setup/main) | install state | `getConnectionConfig`, `checkInstall`, `verifyInstall`, `startSshTunnel` | reads + external (startSshTunnel) | S2 | `verifyInstall` skipped for remote mode (see App.tsx #47/#41/#30) |
| S-25 | n/a (Employees) | `Employees/Employees.tsx` → `components/EmployeeLibrary` | Stub wrapping `EmployeeLibrary` | n/a | n/a | n/a (legacy stub) | S6 | Not in active nav. Consider removing in S6 |
| S-26 | n/a (PlaybookRunner route) | `PlaybookRunner/index.tsx` | Re-export stub | n/a | n/a | n/a (legacy stub) | S6 | Not in active nav. Consider removing in S6 |
| S-27 | n/a (EmployeeLibrary route) | `EmployeeLibrary/index.tsx` | Re-export stub | n/a | n/a | n/a (legacy stub) | S6 | Not in active nav. Consider removing in S6 |

**Active nav screens (S-01 to S-22)**: 22.
**Sub-router stubs (S-25, S-26, S-27)**: 3 (legacy; not in current Layout nav).

---

## 2. IPC Inventory

99 unique preload invoke channels; 117 main handlers. All channels are listed below with their handler source (file:line) and class.

| Renderer call | Preload API | Main handler | Class | Used by screens | Guardrail |
|---|---|---|---|---|---|
| `checkInstall` | `index.ts:39` | `index.ts:306` | read | S-24 | none |
| `verifyInstall` | `index.ts:46` | `index.ts:310` | external (probes local python) | S-24 | remote-mode guard (App.tsx #47) |
| `startInstall` | `index.ts:48` | `index.ts:312` | external (installs hermes) | (via Install route, not main) | S-03 only |
| `onInstallProgress` | `index.ts:51` | (event) | stream | S-03, S-22 | none |
| `getHermesVersion` | `index.ts:78` | `index.ts:324` | read | S-05, S-22 | none |
| `refreshHermesVersion` | `index.ts:80` | `index.ts:325` | external (shells hermes) | S-22 | confirm UX |
| `runHermesDoctor` | `index.ts:82` | `index.ts:329` | external (shells hermes) | S-22 | confirm UX |
| `runHermesUpdate` | `index.ts:84` | `index.ts:330` | external (modifies install) | S-22 | confirm UX; out of v1 redesign |
| `checkOpenClaw` | `index.ts:88` | `index.ts:342` | read | S-22 | none |
| `runClawMigrate` | `index.ts:90` | `index.ts:343` | external (migrates config) | S-22 | confirm UX |
| `getLocale` | `index.ts:93` | `index.ts:355` | read | (theme) | none |
| `setLocale` | `index.ts:94` | `index.ts:356` | writes-config | (theme) | none |
| `getEnv` | `index.ts:98` | `index.ts:360` | read | S-13, S-16, S-10 | contains secrets — UI must redact |
| `setEnv` | `index.ts:101` | `index.ts:362` | writes-config (secrets) | S-04, S-13, S-10, S-16 | UI must not echo values; Slice 6 should keep redaction |
| `getConfig` | `index.ts:104` | `index.ts:378` | read | S-05, S-13, S-22 | none |
| `setConfig` | `index.ts:107` | `index.ts:382` | writes-config | S-05, S-13, S-22 | none |
| `getHermesHome` | `index.ts:110` | `index.ts:390` | read | S-22 | none |
| `getModelConfig` | `index.ts:113` | `index.ts:394` | read | S-05, S-10 | none |
| `setModelConfig` | `index.ts:118` | `index.ts:398` | writes-config | S-04, S-05, S-10 | none |
| `isRemoteMode` | `index.ts:127` | `index.ts:425` | read | (helpers) | none |
| `isRemoteOnlyMode` | `index.ts:128` | `index.ts:426` | read | S-23 | none |
| `getConnectionConfig` | `index.ts:129` | `index.ts:427` | read | S-02, S-22, S-24 | contains secrets — redact |
| `setConnectionConfig` | `index.ts:143` | `index.ts:429` | writes-config (secrets) | S-02, S-22 | UI must not echo |
| `setSshConfig` | `index.ts:150` | `index.ts:443` | writes-config (secrets) | S-02, S-22 | UI must not echo |
| `testRemoteConnection` | `index.ts:160` | `index.ts:464` | external (network) | S-02, S-22 | confirm UX on side effect |
| `testSshConnection` | `index.ts:163` | `index.ts:469` | external (network) | S-02, S-22 | confirm UX |
| `isSshTunnelActive` | `index.ts:172` | `index.ts:491` | read | (helpers) | none |
| `startSshTunnel` | `index.ts:175` | `index.ts:493` | external (long-running) | S-24 | guarded by App.tsx |
| `stopSshTunnel` | `index.ts:178` | `index.ts:502` | external | (helpers) | none |
| `sendMessage` | `index.ts:182` | `index.ts:508` | runtime-action (agent call) | S-05 | primary chat IPC; design target S3 |
| `abortChat` | `index.ts:196` | `index.ts:592` | runtime-action (abort) | S-05, S-23 | paired with sendMessage |
| `onChatChunk`, `onChatDone`, `onChatError`, `onChatToolProgress`, `onChatUsage` | `index.ts:198..251` | (events) | stream | S-05 | none |
| `startGateway` | `index.ts:254` | `index.ts:600` | runtime-action (gateway) | S-16 | confirm UX; S6 redesign |
| `stopGateway` | `index.ts:255` | `index.ts:601` | runtime-action | S-16 | confirm UX |
| `gatewayStatus` | `index.ts:256` | `index.ts:605` | read | S-16 | none |
| `getGatewayState` | `index.ts:759` | `index.ts:609` | read | S-17, S-20, S-21 | none |
| `checkGatewayHealth` | `index.ts:781` | `index.ts:610` | read | S-17, S-21 | none |
| `getCronJobHistory` | `index.ts:773` | `index.ts:615` | read | S-17, S-21 | none |
| `getEvents` | `index.ts:777` | `index.ts:619` | read | S-17, S-20, S-21 | none |
| `listVaultFiles` | `index.ts:763` | `index.ts:623` | read | S-17, S-20 | none |
| `getPlatformEnabled` | `index.ts:259` | `index.ts:652` | read | S-16 | none |
| `setPlatformEnabled` | `index.ts:261` | `index.ts:655` | writes-config | S-16 | confirm UX |
| `listSessions` | `index.ts:269` | `index.ts:668` | read | (Layout handoff) | none |
| `getSessionMessages` | `index.ts:285` | `index.ts:672` | read | S-23 | none |
| `listProfiles` | `index.ts:297` | `index.ts:677` | read | S-07 | none |
| `createProfile` | `index.ts:312` | `index.ts:678` | writes-data (filesystem) | S-07 | confirm UX |
| `deleteProfile` | `index.ts:318` | `index.ts:681` | writes-data (filesystem) | S-07 | confirm UX |
| `setActiveProfile` | `index.ts:323` | `index.ts:684` | writes-config | S-07 | none |
| `readMemory` | `index.ts:327` | `index.ts:690` | read | S-05, S-13 | none |
| `addMemoryEntry` | `index.ts:335` | `index.ts:693` | writes-data | S-13 | none |
| `updateMemoryEntry` | `index.ts:340` | `index.ts:698` | writes-data | S-13 | none |
| `removeMemoryEntry` | `index.ts:346` | `index.ts:703` | writes-data | S-13 | confirm UX |
| `writeUserProfile` | `index.ts:348` | `index.ts:708` | writes-data | S-13 | none |
| `readSoul` | `index.ts:355` | `index.ts:715` | read | S-05, S-12 | none |
| `writeSoul` | `index.ts:357` | `index.ts:716` | writes-data | S-12 | confirm UX |
| `resetSoul` | `index.ts:359` | `index.ts:719` | writes-data | S-12 | confirm UX |
| `getToolsets` | `index.ts:363` | `index.ts:724` | read | S-05, S-14 | none |
| `setToolsetEnabled` | `index.ts:368` | `index.ts:727` | writes-config | S-14 | confirm UX |
| `listInstalledSkills` | `index.ts:376` | `index.ts:735` | read | S-05, S-11 | none |
| `listBundledSkills` | `index.ts:381` | `index.ts:738` | read | S-11 | none |
| `getSkillContent` | `index.ts:390` | `index.ts:739` | read | S-11 | none |
| `installSkill` | `index.ts:392` | `index.ts:742` | writes-data (filesystem) | S-11 | confirm UX |
| `uninstallSkill` | `index.ts:397` | `index.ts:747` | writes-data (filesystem) | S-11 | confirm UX |
| `listCachedSessions` | `index.ts:404` | `index.ts:752` | read | S-06, S-17 | none |
| `syncSessionCache` | `index.ts:418` | `index.ts:757` | external (probes gateway) | S-06 | confirm UX |
| `updateSessionTitle` | `index.ts:429` | `index.ts:758` | writes-data | (helpers) | none |
| `searchSessions` | `index.ts:433` | `index.ts:765` | read | S-06 | none |
| `getCredentialPool` | `index.ts:449` | `index.ts:770` | read (secrets) | S-10 | UI must redact |
| `setCredentialPool` | `index.ts:452` | `index.ts:771` | writes-config (secrets) | S-10 | confirm UX |
| `listModels` | `index.ts:459` | `index.ts:784` | read | S-05, S-09 | none |
| `addModel` | `index.ts:470` | `index.ts:785` | writes-data | S-09, S-10 | none |
| `removeModel` | `index.ts:484` | `index.ts:790` | writes-data | S-09 | confirm UX |
| `updateModel` | `index.ts:487` | `index.ts:791` | writes-data | S-09 | none |
| `claw3d*` (14 calls) | `index.ts:491..553` | `index.ts:798..837` | runtime + writes-config | S-08 | confirm UX on Start/Stop |
| `checkForUpdates`, `downloadUpdate`, `installUpdate`, `getAppVersion` | `index.ts:556..560` | `index.ts:1209,1249,1258,1269` | external (auto-update) | S-23 | out of v1 redesign scope |
| `onUpdateAvailable`, `onUpdateDownloadProgress`, `onUpdateDownloaded`, `onUpdateError` | `index.ts:562..592` | (events) | stream | S-23 | none |
| `onMenuNewChat`, `onMenuSearchSessions` | `index.ts:595..605` | (menu events) | n/a (UI signals) | S-23 | none |
| `listCronJobs` | `index.ts:608` | `index.ts:843` | read | S-15, S-20 | none |
| `createCronJob` | `index.ts:630` | `index.ts:848` | writes-data | S-15 | confirm UX |
| `removeCronJob` | `index.ts:646` | `index.ts:859` | writes-data | S-15 | confirm UX |
| `pauseCronJob` / `resumeCronJob` | `index.ts:653,659` | `index.ts:862,865` | writes-data | S-15 | none |
| `triggerCronJob` | `index.ts:664` | `index.ts:868` | runtime-action (long-running) | S-15 | confirm UX; visible label "Manual trigger" |
| `openExternal` | `index.ts:671` | `index.ts:874` | external (browser) | S-04, S-08, S-13 | URL allowlist |
| `runHermesBackup` | `index.ts:675` | `index.ts:879` | writes-data (filesystem) | S-22 | confirm UX |
| `runHermesImport` | `index.ts:680` | `index.ts:882` | writes-data (filesystem) | S-22 | confirm UX |
| `runHermesDump` | `index.ts:687` | `index.ts:889` | writes-data (filesystem) | S-22 | confirm UX |
| `discoverMemoryProviders` | `index.ts:690` | `index.ts:919` | read | S-13 | none |
| `listMcpServers` | `index.ts:703` | `index.ts:892` | read | S-14, S-22 | none |
| `addMcpServer` | `index.ts:709` | `index.ts:895` | writes-config (subprocess spec) | S-22 | confirm UX |
| `removeMcpServer` | `index.ts:715` | `index.ts:898` | writes-config | S-22 | confirm UX |
| `toggleMcpServer` | `index.ts:721` | `index.ts:901` | writes-config | S-22 | none |
| `testMcpServer` | `index.ts:728` | `index.ts:906` | runtime-action (subprocess) | S-22 | confirm UX |
| `onMcpTestOutput/Done/Error` | `index.ts:731..749` | (events) | stream | S-22 | none |
| `readLogs` | `index.ts:752` | `index.ts:983` | read | S-22 | none |
| `readVaultFile` | `index.ts:766` | `index.ts:923` | read | (Knowledge, not main shell) | spec S6.3 — read-only |
| `getVaultStats` | `index.ts:769` | `index.ts:940` | read | (Knowledge) | spec S6.3 — read-only |
| `knowledgeSearch` | `index.ts:800` | (direct fetch to gateway :8643) | external (HTTP) | S-Knowledge (read) | spec G-10: UI must not enable write side |
| `knowledgeIngest` | `index.ts:804` | (direct POST to gateway :8643) | external (HTTP write) | S-Knowledge (write) | spec G-10: live write side NOT enabled in redesign |
| `getGbrainStats` | `index.ts:808` | (direct GET to gateway :8643) | external (HTTP) | S-Knowledge | read; spec G-10 |
| `listPlaybooks` | `index.ts:819` | `index.ts:987` | read | S-18, S-21, S-Understand | none (enumeration) |
| `runPlaybook` | `index.ts:822` | `index.ts:988` | runtime-action (long-running) | S-Understand | confirm UX; HccCockpit has it disabled in UI but handler exists |
| `onPlaybookStep/Done/Error` | `index.ts:825..843` | (events) | stream | S-17, S-Understand | none |
| `runLlmChecker` | `index.ts:846` | `index.ts:1004` | external (shells llm-checker) | (helpers) | confirm UX |
| `understandAnything` | `index.ts:850` | `index.ts:1007` | writes-data (history dir) | S-19 | confirm UX |
| `listUnderstandingHistory` | `index.ts:853` | `index.ts:1012` | read | S-19 | none |
| `readUnderstandingHistory` | `index.ts:856` | `index.ts:1015` | read | S-19 | none |
| `listPipelineRuns` | `index.ts:785` | `index.ts:1020` | read | S-17, S-20, S-21 | none |

**IPC class totals**:
- read-only: ~50
- writes-config: ~25
- writes-data (filesystem/profile/registry): ~12
- runtime-action (long-running): ~10
- external (network/install/subprocess): ~10
- stream (event subscriptions): ~12

---

## 3. UI Redesign Guardrail Matrix

Per spec §14 (G-01..G-15) applied to current IPC surface.

| Area | Allowed in Slice 1 (additive shell only) | Requires extra approval (Slice 2+) | Forbidden |
|---|---|---|---|
| Visual tokens (--hp-*) | YES — additive only, no existing token rename | rename existing token | override of `--bg-primary` / `--accent` / etc. |
| Sidebar shell | YES — collapse 56px ↔ 220-240px via `⌘\` | grouping by Work/Knowledge/Agents/System (Slice 2) | removing an existing route from nav |
| Inspector pane | YES — empty container, no per-screen wiring | per-screen wiring (Slice 3+ adds Chat/Mission/Knowledge inspectors) | wiring that calls any new IPC |
| Chat view | visual surface only | voice entry MUST be inert placeholder; no actual mic capture | any `runPlaybook` / `triggerCronJob` button in Chat |
| Knowledge Control view | visual surface only | wired to read-only `knowledgeSearch` / `readVaultFile` / `listVaultFiles` only | wired to `knowledgeIngest` write side; wired to any new write IPC |
| Mission Control view | visual surface only | read-only consolidation of BaiLongma + HccCockpit facts | any runtime-action button (no `runPlaybook` / `triggerCronJob` / `startGateway` controls) |
| Settings / Models / Providers | visual surface only | preference-pane restyle (Slice 6); redact secrets in UI | echoing env / API key values back to user |
| HCC Auto Executor | n/a | n/a | any UI element that suggests it is active |
| P3 real execution | n/a | n/a | any UI element that suggests it is running |
| hard cutover | n/a | n/a | any UI element that implies cutover is complete |
| Round 2 C | n/a | n/a | any UI element that references Round 2 C state |
| BaiLongma Productionization | n/a | n/a | any UI text implying productionization is approved |
| L6 live knowledge flush | n/a | n/a | any flush button or status indicator |
| Live `knowledgeIngest` / `knowledgeSearch` write side | n/a | n/a | enabled in redesign board; must stay in existing Knowledge.tsx ingest tab |
| Hermes Kanban dispatcher | n/a | n/a | any UI element that triggers `kanban_*` tool calls |
| Dev server / commit / push | n/a | n/a | running any of these from spec work |
| `~/.hermes/handoff/packs` writes | n/a | n/a | any write to this path from design work |
| `~/.hermes/audit` writes | n/a | n/a | any write to this path from design work |
| Locked roadmap | n/a | n/a | any edit to `docs/roadmap-locked-2026-05-28.md` |
| ClawPanel / BaiLongma code copy | n/a | n/a | copying any code from these projects (AGPL / unknown) |
| New IPC handles | n/a | n/a | adding any new `ipcRenderer.invoke` channel |
| `package.json` | n/a | n/a | any change to dependencies or scripts |

---

## 4. Slice Recommendation Table

| Slice | Can start? | Preconditions | Files likely touched | Risk |
|---|---|---|---|---|
| Slice 0 — Contract Audit | **DONE** (this document) | n/a | `docs/design/UI-SLICE-0-CONTRACT-AUDIT-2026-06-05.md` (this) | none — audit only |
| Slice 1 — Tokens + Components | **YES** | User approval of this audit; spec already approved; 8 open questions locked | additive CSS in `assets/main.css`; no screen edits; possible new `assets/tokens.css` if separable | LOW — additive only; CSS changes; no behavioral change |
| Slice 2 — App Shell | **YES** (after S1) | S1 merged; no IPC changes | `Layout/Layout.tsx`; possible new `Sidebar` component file | MEDIUM — touch to nav and update flow; preserve all 18 routes |
| Slice 3 — Chat Home | **YES** (after S2) | S2 merged; reference spec §6.1.1 | `Chat/Chat.tsx`; possible new `ChatInspector` component | MEDIUM — touch to most-used screen; keep all 18 IPCs; voice MUST be inert |
| Slice 4 — Mission Control | **YES** (after S2/S3) | S2/S3 merged; rename of `bailongma-*` → `mission-*` per spec §15 Q9 | new `Mission/Mission.tsx`; `BaiLongma/BaiLongma.tsx` rename or alias; possible removal of `HccCockpit` as separate screen | MEDIUM — touches read-only cockpit; preserve all 6 read-only IPCs |
| Slice 5 — Knowledge Control Board | **YES** (after S2/S3/S4) | S2-S4 merged; verify `knowledgeSearch` / `readVaultFile` / `listVaultFiles` are read-only | new `KnowledgeControl/KnowledgeControl.tsx`; `Knowledge.tsx` ingest tab preserved | HIGH — must not enable `knowledgeIngest` write side; must not add new write IPC |
| Slice 6 — Preference Panes | **YES** (after S5) | S5 merged; redact secrets in all read paths | restyle `Settings`, `Models`, `Providers`, `Tools`, `Memory`, `Soul`, `Skills` | HIGH — secret redaction across 7+ screens; preserve all write IPCs |
| Slice 7 — Polish | LAST | S1-S6 merged | all screens + accessibility | LOW — visual / a11y only |

---

## 5. Findings

### P0 — none
No P0 issues. No screen calls an unapproved external action. No unapproved IPC is exposed in main shell. Locked roadmap untouched.

### P1 — none
No P1 issues. All 8 open questions are locked at spec defaults (commit `e171213`). Spec is approved (commit `411954b` + `e171213`). License boundaries stated (ClawPanel AGPL, BaiLongma unknown).

### P2 — informational

1. **HccCockpit and BaiLongma overlap**: Both screens display similar data (gateway state, pipeline runs, cron history, events, health). Per spec §6.2 and §15 Q9, S4 will fold them into Mission Control. Both screens are currently read-only — safe to merge.
2. **`runPlaybook` is invoked from `Understand` screen** (S-19, line 175): button "Run Playbook" on a `data.suggested_playbook` result. HccCockpit has the handler wired but does NOT call it from UI (it only subscribes to events). Slice 4 should audit whether the Understand button can be replaced with a "Dry-run preview" link to Mission Control instead.
3. **`triggerCronJob` is exposed in `Schedules`**: S-15 has a "Run now" button. Spec does not forbid runtime-actions in settings; this is a UI affordance the user has today. Slice 6 should keep the existing confirm UX (already present in current code) and label the action "Manual trigger — runs outside scheduled window".
4. **`openExternal` is called from `Memory`, `Office`, `Setup`**: URL allowlist is in `src/main/index.ts:874`. Slice 6 should keep this gate; redesign must not bypass it.
5. **Three legacy stub routes** (`Employees`, `PlaybookRunner`, `EmployeeLibrary`): not in current nav. S6 cleanup is optional.
6. **`knowledgeIngest` write side**: Knowledge.tsx ingest tab is the only live write path. Spec G-10 says it stays. Slice 5 must verify the new Knowledge Control board does NOT call `knowledgeIngest`. Knowledge.tsx is unchanged.
7. **`getGatewayState` handler returns `null` in main** (`index.ts:609`): comment says "stub for future; uses AgentMonitor IPC instead". Not a Slice 0 issue; S4 can decide if a real handler is needed.
8. **`updateSessionTitle` IPC exists but no screen uses it**: dead code? Or wired elsewhere? Not a Slice 0 blocker; S6 can audit.

---

## 6. UI Ground Truth Drift Check

Compared to `docs/design/UI-GROUND-TRUTH-2026-06-04.md`:

- §2 "current UI module status" mentions `BaiLongma`, `Knowledge`, main nav. **Matches current code** (S-20, S-Knowledge, S-23).
- §3 prerequisites — all 6 still hold. No drift.
- §4 hard freezes — all 7 still hold. No drift.
- §5 V1-V7 matrix — not in scope for this audit; would need separate version check. **No drift detected in this audit's scope** (current UI).
- §6 §7 — process notes, not in code-drift scope.

**No factual drift detected in ground truth. No update needed.** If a future Slice finds drift, the update must be clearly labeled per task instruction.

---

## 7. Slice 1 Pre-flight Check

Per spec §11.2 per-slice gates and this audit's §3 guardrail matrix:

- [x] S1 = additive CSS only (no existing token rename)
- [x] S1 does not add any new IPC
- [x] S1 does not touch src/renderer components (only assets/main.css or new tokens.css)
- [x] S1 does not change package.json
- [x] S1 does not start dev server
- [x] S1 does not write to handoff/audit
- [x] S1 does not trigger cron, gateway, or any runtime
- [x] S1 does not modify locked roadmap
- [x] User has approved spec direction
- [x] All open questions locked at defaults
- [x] This Slice 0 audit document exists

**Slice 1 can start.** It is the lowest-risk first implementation slice.
