import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "fs";
import { resolve } from "path";
import { StatusBadge } from "./StatusBadge";

const badgeSrc = readFileSync(
  resolve(__dirname, "StatusBadge.tsx"),
  "utf-8",
);

describe("StatusBadge component (UI-CN-001a)", () => {
  describe("render output", () => {
    it("renders read_only bilingual visible text", () => {
      render(<StatusBadge kind="read_only" />);
      expect(screen.getByText("只读 · Read-only")).toBeTruthy();
    });

    it("renders default title with canonical English anchors", () => {
      render(<StatusBadge kind="read_only" />);
      const el = screen.getByText("只读 · Read-only");
      const title = el.getAttribute("title");
      expect(title).toContain("Read-only");
      expect(title).toContain("No writes");
      expect(title).toContain("Productionization NOT APPROVED");
    });

    it("tooltip prop overrides default title", () => {
      render(
        <StatusBadge kind="read_only" tooltip="view=mission · kind=read_only" />,
      );
      const el = screen.getByText("只读 · Read-only");
      const title = el.getAttribute("title");
      expect(title).toContain("view=mission");
      expect(title).not.toContain("风险分级 P3");
    });

    it("renders mixed bilingual label", () => {
      render(<StatusBadge kind="mixed" />);
      expect(screen.getByText("读写混合 · Mixed")).toBeTruthy();
    });

    it("renders read_write_runtime bilingual label", () => {
      render(<StatusBadge kind="read_write_runtime" />);
      expect(screen.getByText("可执行 · Runtime")).toBeTruthy();
    });

    it("renders read_write_config bilingual label", () => {
      render(<StatusBadge kind="read_write_config" />);
      expect(screen.getByText("配置写入 · Config")).toBeTruthy();
    });

    it("renders external_action bilingual label", () => {
      render(<StatusBadge kind="external_action" />);
      expect(screen.getByText("外部动作 · External")).toBeTruthy();
    });

    it("applies custom className when provided", () => {
      render(<StatusBadge kind="read_only" className="shell-status-badge--read_only--P3" />);
      const el = screen.getByText("只读 · Read-only");
      expect(el.className).toContain("shell-status-badge--read_only--P3");
    });
  });

  describe("purity check", () => {
    it("has zero IPC, fetch, or runtime calls", () => {
      expect(badgeSrc).not.toMatch(/ipcRenderer|ipcMain|fetch\s*\(/);
      expect(badgeSrc).not.toMatch(/window\.hermesAPI/);
    });

    it("imports label data from boundary-badge (single source of truth)", () => {
      // StatusBadge must NOT maintain a BADGE_LABELS copy — it must
      // import getBoundaryKindLabel from boundary-badge.ts instead.
      expect(badgeSrc).toContain("getBoundaryKindLabel");
      expect(badgeSrc).not.toMatch(/BADGE_LABELS\s*:/);
    });
  });
});
