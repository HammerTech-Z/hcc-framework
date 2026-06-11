// ConfirmDialog — UI-CN-001b (2026-06-11).
// Pure presentational component. Zero IPC, zero runtime, zero network.
// Renders a confirmation dialog for dangerous actions in 中文 · English
// bilingual format. The caller must wire onConfirm / onCancel; this
// component is purely visual — it does not execute or gate any action.

import type { ReactElement } from "react";

export interface ConfirmDialogLastRun {
  time: string;
  result: string;
}

export interface ConfirmDialogProps {
  /** Action name shown in the title (e.g. "删除文件"). */
  actionName: string;
  /** One-sentence impact description. */
  description: string;
  /** Whether the action can be undone. Determines the reversal hint. */
  reversible: boolean;
  /** Optional last-run info for context display. */
  lastRun?: ConfirmDialogLastRun;
  /** Called when the user clicks the confirm button. */
  onConfirm: () => void;
  /** Called when the user clicks the cancel button or dismisses. */
  onCancel: () => void;
}

export function ConfirmDialog({
  actionName,
  description,
  reversible,
  lastRun,
  onConfirm,
  onCancel,
}: ConfirmDialogProps): ReactElement {
  return (
    <div
      className="hp-confirm-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`确认执行「${actionName}」`}
    >
      <div className="hp-confirm-dialog-box">
        <h2 className="hp-confirm-dialog-title">
          确认执行「{actionName}」？
        </h2>
        <p className="hp-confirm-dialog-desc">
          {description}。{reversible ? "此操作可撤销" : "此操作不可撤销"}。
        </p>
        {lastRun && (
          <p className="hp-confirm-dialog-last-run">
            上次执行：{lastRun.time} · {lastRun.result}
          </p>
        )}
        <div className="hp-confirm-dialog-actions">
          <button
            type="button"
            className="hp-confirm-dialog-cancel"
            onClick={onCancel}
            autoFocus
          >
            取消
          </button>
          <button
            type="button"
            className="hp-confirm-dialog-confirm"
            onClick={onConfirm}
          >
            确认执行
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pre-built scenarios (audit §G, 4 high-frequency confirm actions) ───

export interface ConfirmScenario {
  actionName: string;
  description: string;
  reversible: boolean;
}

/** Delete a vault/source file. Irreversible. */
export const SCENARIO_DELETE_FILE: ConfirmScenario = {
  actionName: "删除文件",
  description: "删除文件需要人工确认",
  reversible: false,
};

/** Install an external dependency. Irreversible. */
export const SCENARIO_INSTALL_DEPENDENCY: ConfirmScenario = {
  actionName: "安装依赖",
  description: "安装依赖会改变运行环境，需审批后执行",
  reversible: false,
};

/** Batch-modify {n} files. Irreversible. */
export function scenarioBatchModify(fileCount: number): ConfirmScenario {
  return {
    actionName: "批量修改",
    description: `将修改 ${fileCount} 个文件。批量修改风险较高，请先确认影响范围`,
    reversible: false,
  };
}

/** Manually trigger a cron job. Reversible (= re-scheduling the job). */
export function scenarioCronManualTrigger(jobName: string): ConfirmScenario {
  return {
    actionName: "运行定时任务",
    description: `将立即运行「${jobName}」`,
    reversible: true,
  };
}
