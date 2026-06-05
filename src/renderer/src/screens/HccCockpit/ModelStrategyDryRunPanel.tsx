// Hermes Pro Model Strategy dry-run panel (MODEL-STRATEGY-003A-1).
// Read-only display. No IPC, no fetch, no runtime routing.
// All inputs come from the canonical shared snapshots and the
// pure-function UI status descriptor.

import { useMemo } from "react";

import { buildModelStrategyDisabledStatuses } from "../../../../shared/lib/model-strategy-ui-status";
import {
  MODEL_STRATEGY_DRY_RUN_SNAPSHOT,
  PROVIDER_CATALOG_SNAPSHOT,
  SMOKE_TEST_MATRIX_SNAPSHOT,
} from "../../../../shared/lib/model-strategy-snapshots";

const PANEL_CLASS = "model-strategy-dry-run-panel";

export function ModelStrategyDryRunPanel(): React.JSX.Element {
  const statuses = useMemo(
    () =>
      buildModelStrategyDisabledStatuses(
        MODEL_STRATEGY_DRY_RUN_SNAPSHOT,
        PROVIDER_CATALOG_SNAPSHOT,
        SMOKE_TEST_MATRIX_SNAPSHOT,
      ).statuses,
    [],
  );

  return (
    <section
      className={PANEL_CLASS}
      data-testid="model-strategy-dry-run-panel"
      aria-labelledby="model-strategy-dry-run-panel-title"
    >
      <header className={`${PANEL_CLASS}__header`}>
        <h2 id="model-strategy-dry-run-panel-title">
          Model Strategy — dry-run only
        </h2>
        <p
          className={`${PANEL_CLASS}__banner`}
          data-testid="model-strategy-dry-run-banner"
        >
          dry-run only · no live config writes · no runtime routing · HCC Auto
          Executor paused
        </p>
      </header>

      <ul
        className={`${PANEL_CLASS}__list`}
        data-testid="model-strategy-dry-run-list"
      >
        {statuses.map((status) => (
          <li
            key={status.lane}
            className={`${PANEL_CLASS}__row`}
            data-testid={`model-strategy-row-${status.lane}`}
          >
            <div className={`${PANEL_CLASS}__cell ${PANEL_CLASS}__cell--lane`}>
              <span className={`${PANEL_CLASS}__lane-name`}>
                {status.lane}
              </span>
              <span className={`${PANEL_CLASS}__lane-label`}>
                {status.label}
              </span>
            </div>
            <div
              className={`${PANEL_CLASS}__cell ${PANEL_CLASS}__cell--model`}
              data-testid={`model-strategy-model-${status.lane}`}
            >
              {status.provider} / {status.candidateModel}
            </div>
            <div
              className={`${PANEL_CLASS}__cell ${PANEL_CLASS}__cell--state`}
              data-testid={`model-strategy-state-${status.lane}`}
            >
              <span
                className={`${PANEL_CLASS}__pill ${PANEL_CLASS}__pill--disabled`}
                data-testid={`model-strategy-enabled-${status.lane}`}
                data-enabled="false"
                data-disabled="true"
              >
                disabled
              </span>
              <span className={`${PANEL_CLASS}__pill ${PANEL_CLASS}__pill--neutral`}>
                {status.verificationState}
              </span>
            </div>
            <div
              className={`${PANEL_CLASS}__cell ${PANEL_CLASS}__cell--status`}
            >
              <span className={`${PANEL_CLASS}__status`}>
                catalog: {status.catalogStatus}
              </span>
              <span className={`${PANEL_CLASS}__status`}>
                smoke: {status.smokeStatus}
              </span>
              {status.requiresUserIntent ? (
                <span className={`${PANEL_CLASS}__status`}>
                  user-intent required
                </span>
              ) : null}
            </div>
            <div
              className={`${PANEL_CLASS}__cell ${PANEL_CLASS}__cell--reason`}
              data-testid={`model-strategy-reason-${status.lane}`}
            >
              {status.disabledReason || "—"}
            </div>
          </li>
        ))}
      </ul>

      <footer
        className={`${PANEL_CLASS}__footer`}
        data-testid="model-strategy-dry-run-footer"
      >
        snapshot version 1.0.0 · {statuses.length} lanes · read-only
      </footer>
    </section>
  );
}

export default ModelStrategyDryRunPanel;
