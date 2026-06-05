# Hermes Pro Model Strategy Plan

Date: 2026-06-05
Status: planned, dry-run only
Owner: unassigned

## 1. Purpose

Define a Hermes Pro model strategy that keeps the current working setup intact while preparing a Phoenix-inspired, Hermes-native model lane system.

Current working setup:

- Daily model: `minimax2.7`
- Current fallback: `deepseekV4pro`
- Target daily candidate: `MiniMax 3.0` (user-selected target; provider catalog resolution pending)
- Target complex-code candidate: `gpt-5.5` (OpenAI API candidate; smoke test pending)

Target outcome:

- Preserve the current MiniMax + DeepSeek working path until every new lane passes verification.
- Add explicit model lanes for daily, local fallback, lightweight tasks, complex code, task fallback, and god-mode reasoning.
- Make the strategy visible and switchable in Hermes Pro UI.
- Do not write `~/.hermes/config.yaml` until a later approved implementation slice.

## 2. Non-goals

- Do not change `~/.hermes/config.yaml`.
- Do not write API keys or expose secrets.
- Do not enable automatic runtime routing.
- Do not enable HCC Auto Executor.
- Do not enable P3 real execution.
- Do not change `docs/roadmap-locked-2026-05-28.md`.
- Do not copy Phoenix runtime code directly.

## 3. Design Source

This plan borrows Phoenix's useful model-lane idea, but the implementation must remain Hermes Pro native.

Phoenix concepts to reuse:

- Daily lane.
- Fallback lane.
- Higher-cost lanes require explicit user intent.
- Model/provider/base URL must stay as a matched bundle.

Phoenix concepts not to copy directly:

- Phoenix runtime router.
- Silent auto-upgrade to expensive models.
- Provider assumptions that are not already verified in Hermes Pro.
- Any installer behavior that writes live secrets or changes runtime config without user review.

## 4. Target Lanes

| Lane | Purpose | Target provider | Target model policy | Enablement |
| --- | --- | --- | --- | --- |
| `daily` | Normal chat and day-to-day work | MiniMax | target candidate `MiniMax 3.0`; exact API model id must be resolved by provider catalog | default after smoke pass |
| `daily_fallback` | Local rescue path when daily cloud fails | local OpenAI-compatible endpoint | Gemma 4 12B multimodal candidate | only after local health check |
| `light_task` | Small summaries, simple edits, low-risk planning | MiniMax | target candidate `MiniMax 3.0` unless a cheaper MiniMax lane is verified | manual/profile routing first |
| `complex_code` | Hard coding tasks and large patch planning | OpenAI | target candidate `gpt-5.5`; provider-current code-capable equivalent allowed only after verification | explicit user action |
| `task_fallback` | General task fallback if premium/code lane fails | DeepSeek | latest DeepSeek API; current candidate `deepseek-v4-pro`, cost fallback `deepseek-v4-flash` | fallback only |
| `god` | Highest reasoning lane | Anthropic | latest Claude Opus API; concrete model id resolved at verification time | explicit user action |

Implementation must treat "latest" and display names as provider-catalog resolution policies, not as hardcoded promises. Each lane stores both the chosen concrete model id and the resolution metadata used at the time of verification.

MiniMax note: `MiniMax 3.0` is the user-selected daily target. Hermes Pro must not write `provider: minimax` with an empty `base_url` until MODEL-STRATEGY-002 resolves the exact MiniMax API model id and canonical endpoint.

## 5. Gemma Decision

The local fallback lane should prefer Gemma 4 12B over Gemma 4 E4B if the machine can run it reliably.

Decision rationale:

- Gemma 4 E4B is the lighter local candidate and may be useful on constrained hardware.
- Gemma 4 12B is the stronger target for a daily fallback lane because the lane needs language, vision, and code coverage.
- Hermes Pro must not assume Gemma 4 12B is usable until the local endpoint passes smoke tests.

Fallback decision rule:

1. Try Gemma 4 12B multimodal local endpoint.
2. If memory, latency, or multimodal support fails, mark Gemma 4 12B unavailable.
3. Offer Gemma 4 E4B as a lightweight fallback candidate, but label it lower-capability.
4. Keep DeepSeek as the remote task fallback.

## 6. Planned Dry-run Schema

This schema is for design and fixtures only. It must not be written to live config in this slice.

```yaml
model_strategy:
  enabled: false
  mode: dry_run
  active_profile: hermes-balanced-2026-06
  lanes:
    daily:
      provider: minimax
      model_policy: target_user_selected
      candidate_model: MiniMax 3.0
      requires_provider_catalog_resolution: true
      requires_smoke_test: true
    daily_fallback:
      provider: custom
      lane_provider_label: local
      model_policy: pinned_local
      candidate_model: gemma-4-12b-it
      base_url: http://localhost:1234/v1
      requires_multimodal_smoke_test: true
    light_task:
      provider: minimax
      model_policy: target_user_selected_or_cheaper_verified
      candidate_model: MiniMax 3.0
      requires_provider_catalog_resolution: true
      requires_smoke_test: true
    complex_code:
      provider: openai
      model_policy: pinned_api_candidate
      candidate_model: gpt-5.5
      requires_user_intent: true
      requires_smoke_test: true
    task_fallback:
      provider: deepseek
      model_policy: latest_stable
      candidate_model: deepseek-v4-pro
      cost_fallback_model: deepseek-v4-flash
      requires_smoke_test: true
    god:
      provider: anthropic
      model_policy: latest_opus
      candidate_model: provider_current_opus
      requires_provider_catalog_resolution: true
      requires_user_intent: true
      requires_smoke_test: true
```

## 7. UI Plan

Add a future "Model Strategy" section under the existing model/provider settings surface.

Required UI behavior:

- Show the active strategy profile.
- Show each lane as a compact card.
- Let the user choose provider, model, base URL, and policy per lane.
- Show whether each lane is verified, untested, failed, or unavailable.
- Provide a `Test` action per lane.
- Provide a `Test all lanes` action.
- Disable `Enable strategy` until required smoke tests pass.
- Show a clear rollback path to the current MiniMax + DeepSeek setup.

The UI must not expose raw API keys. Secrets remain in the existing provider/credential surfaces.

## 8. Verification Plan

Each lane needs an explicit smoke test.

| Lane | Required checks |
| --- | --- |
| `daily` | MiniMax 3.0 concrete model id resolution, canonical endpoint resolution, text completion, streaming compatibility, tool-call JSON stability |
| `daily_fallback` | local endpoint health, text completion, image input capability, latency budget, memory pressure note |
| `light_task` | MiniMax 3.0 or cheaper verified MiniMax concrete model id, short completion, low-cost routing label |
| `complex_code` | GPT-5.5 API availability, small code patch sample, structured output, refusal/error handling |
| `task_fallback` | completion, rate-limit/error fallback behavior, no wrong model-id |
| `god` | reasoning response, explicit-user-intent gate, cost warning |

## 9. Routing Rules

Phase 1 is manual and profile-based.

- Default chat uses `daily`.
- If `daily` fails and local health is green, try `daily_fallback`.
- Simple internal tasks can use `light_task`.
- Complex coding tasks use `complex_code` only when explicitly selected or when a future approved HCC marker requests it.
- Failed complex tasks can fall back to `task_fallback`.
- `god` is never automatic in Phase 1.

## 10. Safety Rules

- No lane can be enabled without a verified provider/model/base URL bundle.
- Local Gemma must fail closed if the endpoint is missing or multimodal support is absent.
- Remote premium lanes must require explicit user intent.
- Secrets stay in existing provider settings.
- Runtime config writes require a separate approved implementation slice.
- The current MiniMax + DeepSeek setup remains the rollback baseline.

## 11. Implementation Slices

### MODEL-STRATEGY-001: Dry-run design and fixture

Status: planned

Deliverables:

- This design document.
- A dry-run fixture for the target lane matrix.
- Pure validation helpers.
- Tests for lane schema, safety invariants, and no-live-config writes.

### MODEL-STRATEGY-002: Provider catalog resolution

Status: future

Resolve display-name and policy lanes into concrete model IDs. Resolution must be inspectable and cached with timestamps.

Initial required resolutions:

- MiniMax daily target: `MiniMax 3.0` display name -> exact API `model` id + canonical base URL.
- OpenAI complex-code target: `gpt-5.5` -> endpoint support, account availability, pricing/cost warning.
- Anthropic god target: `latest_opus` -> current concrete Opus id at verification time.

### MODEL-STRATEGY-003: UI readiness plan

Status: future

Define the UI component contract and acceptance fixtures before implementation.

### MODEL-STRATEGY-004: UI implementation

Status: future, requires approval

Add the Model Strategy UI section without changing live runtime behavior.

### MODEL-STRATEGY-005: Live config adapter

Status: future, requires explicit approval

Only after all previous slices pass, implement controlled writes to Hermes config with backup and rollback.

## 12. Acceptance Criteria

- Plan exists in `docs/model-strategy/`.
- `docs/tech-debt.md` points TD-MODEL-001 to this plan.
- No live config files are changed.
- No locked roadmap file is changed.
- No runtime code is added in the planning slice.
- Current MiniMax + DeepSeek setup remains documented as rollback baseline.

## 13. Current Decision

Adopt the model-lane strategy as a planned Hermes Pro direction.

Do not activate it yet.
