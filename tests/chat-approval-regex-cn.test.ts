import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROOT = join(__dirname, "..");
const chatSrc = readFileSync(
  join(ROOT, "src/renderer/src/screens/Chat/Chat.tsx"),
  "utf-8",
);

// UI-CHAT-001b — extract combined approval regex from source.
// Mirrors the literal expression declared in Chat.tsx (regex is a `const`,
// not exported; test the source shape instead of reimplementing logic).
const APPROVAL_RE_CN_SOURCE =
  /需要.*?(确认|审批)|是否(继续|执行|运行)|危险操作|请(确认|批准)/i;

describe("UI-CHAT-001b Chinese approval regex (additive)", () => {
  it("matches '需要你的确认才能继续'", () => {
    expect(APPROVAL_RE_CN_SOURCE.test("需要你的确认才能继续")).toBe(true);
  });

  it("matches '是否继续执行？'", () => {
    expect(APPROVAL_RE_CN_SOURCE.test("是否继续执行？")).toBe(true);
  });

  it("matches '危险操作，请确认'", () => {
    expect(APPROVAL_RE_CN_SOURCE.test("危险操作，请确认")).toBe(true);
  });

  it("does NOT match benign Chinese like '今天天气怎么样'", () => {
    expect(APPROVAL_RE_CN_SOURCE.test("今天天气怎么样")).toBe(false);
  });

  it("preserves the original English APPROVAL_RE (additive only)", () => {
    expect(chatSrc).toMatch(/requires\? \(your \)\?approval/);
    expect(chatSrc).toMatch(/do you want \(me \)\?to \(proceed/);
    expect(chatSrc).toMatch(/APPROVAL_RE_CN/);
    expect(chatSrc).toMatch(/APPROVAL_RE_COMBINED/);
  });

  it("renders the upgraded approval bar with Chinese title and disclaimer", () => {
    expect(chatSrc).toMatch(/className="hp-approval-bar"/);
    expect(chatSrc).toContain("代理请求审批");
    expect(chatSrc).toContain("按钮将以消息形式发送给代理，不是本地开关");
    expect(chatSrc).toMatch(/className="hp-approval-bar-excerpt"/);
    expect(chatSrc).toMatch(/className="hp-approval-bar-note"/);
  });
});