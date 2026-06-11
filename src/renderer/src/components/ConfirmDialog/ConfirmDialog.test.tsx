import { describe, expect, it } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { vi } from "vitest";
import {
  ConfirmDialog,
  SCENARIO_DELETE_FILE,
  SCENARIO_INSTALL_DEPENDENCY,
  scenarioBatchModify,
  scenarioCronManualTrigger,
} from "./ConfirmDialog";

const dialogSrc = readFileSync(
  resolve(__dirname, "ConfirmDialog.tsx"),
  "utf-8",
);

describe("ConfirmDialog component (UI-CN-001b)", () => {
  describe("render output", () => {
    it("renders Chinese title with action name", () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      render(
        <ConfirmDialog
          actionName="删除文件"
          description="删除文件需要人工确认"
          reversible={false}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );
      expect(screen.getByText("确认执行「删除文件」？")).toBeTruthy();
    });

    it("renders description with irreversible hint", () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      render(
        <ConfirmDialog
          actionName="安装依赖"
          description="安装依赖会改变运行环境，需审批后执行"
          reversible={false}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );
      expect(
        screen.getByText(/安装依赖会改变运行环境.*此操作不可撤销/),
      ).toBeTruthy();
    });

    it("renders reversible hint when reversible=true", () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      render(
        <ConfirmDialog
          actionName="运行定时任务"
          description="将立即运行「cleanup」"
          reversible={true}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );
      expect(screen.getByText(/此操作可撤销/)).toBeTruthy();
    });

    it("renders lastRun context when provided", () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      render(
        <ConfirmDialog
          actionName="删除文件"
          description="删除文件需要人工确认"
          reversible={false}
          lastRun={{ time: "2026-06-10 14:00", result: "成功" }}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );
      expect(screen.getByText(/上次执行.*2026-06-10.*成功/)).toBeTruthy();
    });

    it("does not render lastRun when not provided", () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      render(
        <ConfirmDialog
          actionName="删除文件"
          description="删除文件需要人工确认"
          reversible={false}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );
      expect(screen.queryByText(/上次执行/)).toBeNull();
    });

    it("renders cancel button (取消) with autoFocus", () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      render(
        <ConfirmDialog
          actionName="删除文件"
          description="删除文件需要人工确认"
          reversible={false}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );
      const cancelBtn = screen.getByText("取消");
      expect(cancelBtn).toBeTruthy();
      expect(cancelBtn).toHaveFocus();
    });

    it("renders confirm button (确认执行) with orange accent", () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      render(
        <ConfirmDialog
          actionName="删除文件"
          description="删除文件需要人工确认"
          reversible={false}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );
      const confirmBtn = screen.getByText("确认执行");
      expect(confirmBtn).toBeTruthy();
      expect(confirmBtn.className).toContain("hp-confirm-dialog-confirm");
    });

    it("fires onConfirm when confirm button is clicked", () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      render(
        <ConfirmDialog
          actionName="删除文件"
          description="删除文件需要人工确认"
          reversible={false}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );
      fireEvent.click(screen.getByText("确认执行"));
      expect(onConfirm).toHaveBeenCalledTimes(1);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it("fires onCancel when cancel button is clicked", () => {
      const onConfirm = vi.fn();
      const onCancel = vi.fn();
      render(
        <ConfirmDialog
          actionName="删除文件"
          description="删除文件需要人工确认"
          reversible={false}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />,
      );
      fireEvent.click(screen.getByText("取消"));
      expect(onCancel).toHaveBeenCalledTimes(1);
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe("pre-built scenarios", () => {
    it("DELETE_FILE: irreversible delete action", () => {
      expect(SCENARIO_DELETE_FILE.actionName).toBe("删除文件");
      expect(SCENARIO_DELETE_FILE.reversible).toBe(false);
    });

    it("INSTALL_DEPENDENCY: irreversible install action", () => {
      expect(SCENARIO_INSTALL_DEPENDENCY.actionName).toBe("安装依赖");
      expect(SCENARIO_INSTALL_DEPENDENCY.reversible).toBe(false);
    });

    it("batchModify(n): dynamic file count in description", () => {
      const s = scenarioBatchModify(5);
      expect(s.actionName).toBe("批量修改");
      expect(s.description).toContain("5 个文件");
      expect(s.reversible).toBe(false);
    });

    it("cronManualTrigger(name): dynamic job name, reversible", () => {
      const s = scenarioCronManualTrigger("nightly-sync");
      expect(s.actionName).toBe("运行定时任务");
      expect(s.description).toContain("nightly-sync");
      expect(s.reversible).toBe(true);
    });
  });

  describe("purity check", () => {
    it("has zero IPC, fetch, or runtime calls", () => {
      expect(dialogSrc).not.toMatch(/ipcRenderer|ipcMain|fetch\s*\(/);
      expect(dialogSrc).not.toMatch(/window\.hermesAPI/);
    });

    it("does not import from preload/main/electron", () => {
      expect(dialogSrc).not.toMatch(/from\s+["'][^"']*preload[^"']*["']/);
      expect(dialogSrc).not.toMatch(/from\s+["'][^"']*main[^"']*["']/);
      expect(dialogSrc).not.toContain("electron");
    });
  });
});
