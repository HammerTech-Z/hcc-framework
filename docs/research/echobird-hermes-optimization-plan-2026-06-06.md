# EchoBird -> Hermes Pro Optimization Plan

Date: 2026-06-06
Status: partial GO implemented as Hermes-native design descriptors, no runtime
Source: https://github.com/edison7009/EchoBird

## 1. Decision

EchoBird should be treated as a product and workflow reference, not as code to embed.

It is useful for Hermes Pro in three areas:

- Model center / model lane UX.
- Install and repair workflow.
- AI app / project management surface.

It is not suitable as a runtime dependency because EchoBird v5 is BUSL-1.1, its public Tauri shell depends on a private `echobird_core`, and its UI/trade-dress policy explicitly protects the four-surface product composition.

## 2. Current Integration State

EchoBird is not embedded in Hermes Pro.

Local read-only search found no existing `EchoBird`, `edison7009`, or `echobird` references in Hermes `docs`, `src`, `tests`, or package files before this plan.

As of 2026-06-06, EchoBird has been used only as a product-pattern reference for MODEL-STRATEGY:

| Slice | Commit | Status | Runtime impact |
| --- | --- | --- | --- |
| 005 plan | `5c42038` | registered EchoBird as product reference | none |
| 005A | `f86fe30` | pattern taxonomy, design-reference-only | none |
| 005B | `c6c8f02` | Hermes-native model-nexus design descriptor | none |
| 005C | `563026c` | install/recovery read-only diagnostics descriptor | none |
| 006A | `c68f20c` | lane/provider requirements design descriptor for user-configured providers | none |

The resulting Hermes descriptors keep EchoBird code, UI composition, install scripts, private core behavior, local runtime activation, credential pool integration, and live config writes out of scope. Cloud model providers remain user-configured: users supply API keys / endpoints through future approved credential surfaces, not through docs, fixtures, or descriptors.

## 3. Useful EchoBird Patterns

| Pattern | EchoBird surface | Hermes target | Value |
| --- | --- | --- | --- |
| Model Nexus | Central model data hub, provider directory, latency test | Hermes model strategy UI | High |
| One-click local LLM | vLLM / SGLang / llama.cpp local runtime choice | Local fallback lane planning | Medium-high |
| Install & Repair Agent | Tool install manifests and failure recovery | Hermes install/recovery guidance | High |
| My AI Projects | App/game project onboarding | HCC project intake and cockpit surface | Medium |
| App Manager | Launch/manage AI tools | BaiLongma/HCC app inventory | Medium |
| AI News / Star Projects | Daily AI brief | Knowledge discovery candidate | Low |

## 4. Non-goals

- Do not copy EchoBird code.
- Do not install or run EchoBird.
- Do not run EchoBird install scripts.
- Do not copy EchoBird UI/trade dress.
- Do not adopt `echobird_core` or any private dependency.
- Do not write Hermes runtime config.
- Do not enable HCC Auto Executor.
- Do not modify `docs/roadmap-locked-2026-05-28.md`.

## 5. Execution Plan

### ECHO-HERMES-001: Read-only Product Pattern Audit

Status: landed through MODEL-STRATEGY-005A (`f86fe30`)

Scope:

- Inventory EchoBird model center, local LLM, install repair, app manager, and project manager surfaces.
- Record license constraints and private-core constraints.
- Produce a Hermes mapping table.

Allowed files:

- `docs/research/*`
- optional fixture under `tests/fixtures/external-research/*` if a later slice needs structured evidence

Exit criteria:

- No source import.
- No runtime call.
- No config write.
- Locked roadmap unchanged.

### ECHO-HERMES-002: Model Nexus Comparison

Status: landed through MODEL-STRATEGY-005B (`c6c8f02`) and 006A (`c68f20c`)

Scope:

- Compare EchoBird Model Nexus with Hermes model strategy lanes.
- Extract Hermes-native requirements for provider directory, endpoint test, model ID resolution, latency test, and rollback state.
- Feed results into `MODEL-STRATEGY-003A`, `MODEL-STRATEGY-004A/004B/004C`, `MODEL-STRATEGY-005B`, and `MODEL-STRATEGY-006A`.

Exit criteria:

- New requirements are Hermes-native, not copied from EchoBird.
- Existing MiniMax + DeepSeek rollback remains intact.
- UI remains disabled until smoke tests pass.

### ECHO-HERMES-003: Install & Repair Playbook Design

Status: landed as read-only diagnostics descriptor through MODEL-STRATEGY-005C (`563026c`)

Scope:

- Use EchoBird's install-manifest concept as a reference for Hermes install and repair documentation.
- Design a Hermes-native install/recovery playbook for blocked network environments.
- Treat mirror/proxy usage as a documented fallback, not automatic runtime behavior.

Exit criteria:

- No install script execution.
- No shell automation added.
- No network probing added to runtime.

### ECHO-HERMES-004: AI App / Project Manager Cockpit Design

Status: future / product planning only

Scope:

- Evaluate whether BaiLongma / HCC Cockpit should show AI apps, model endpoints, local runtimes, and project entry points in one inventory surface.
- Keep this as UI/product planning only.

Exit criteria:

- No App Manager runtime.
- No launcher integration.
- No HCC Auto Executor state change.

### ECHO-HERMES-005: Closeout / GO-NO-GO

Status: PARTIAL GO for Model Nexus, local fallback UX, lane/provider requirements, and install/recovery diagnostics only.

Scope:

- Decide whether EchoBird remains in the candidate pool.
- Recommended default is PARTIAL GO for Model Nexus and Install & Repair references only.

Outcome:

- PARTIAL GO: keep Model Nexus, local fallback UX, user-configured provider requirements, and install/recovery diagnostics as Hermes-native design references.
- Keep AI app / project inventory as future product planning only.
- NO runtime dependency, NO copied UI, NO install script execution, NO live config adapter.

## 6. Risk Matrix

| Risk | Direct embedding | This plan |
| --- | --- | --- |
| License contamination | High | Low |
| Private core dependency | High | None |
| UI/trade-dress conflict | Medium-high | Low |
| Runtime attack surface | High | None |
| Model config drift | Medium | Low |
| HCC status confusion | Medium | Low |

## 7. Recommended Placement

Use EchoBird as a downstream reference for:

- `MODEL-STRATEGY-003A`: read-only UI readiness and HccCockpit panel integration.
- `MODEL-STRATEGY-004A/004B/004C`: dry-run rollout simulation, rollback preview, and UI status projection helpers.
- `MODEL-STRATEGY-005A/005B/005C`: taxonomy, Hermes-native model-nexus descriptor, and install/recovery diagnostics.
- `MODEL-STRATEGY-006A`: user-configured lane/provider requirements, including local fallback endpoint requirements and secret redaction.
- A future HCC Cockpit product inventory design.

Do not place EchoBird in:

- HCC Auto Executor.
- Knowledge live flush.
- Runtime dispatch.
- Gateway / IPC / cron.
- Locked roadmap.

## 8. Success Criteria

EchoBird improves Hermes only if:

- Model lane setup becomes easier to understand and verify.
- Provider/model/base URL bundles are less likely to drift.
- Install and recovery documentation becomes more actionable.
- HCC Cockpit gains clearer product inventory planning.
- No EchoBird code, scripts, private core, or protected UI composition is imported.
- API keys and provider secrets remain user-provided and are never echoed by docs, fixtures, or design descriptors.
