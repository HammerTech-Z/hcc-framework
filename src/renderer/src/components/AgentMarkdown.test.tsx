import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { AgentMarkdown, safeMarkdownExternalHref } from "./AgentMarkdown";

describe("AgentMarkdown", () => {
  beforeEach(() => {
    (window as any).hermesAPI = {
      openExternal: vi.fn(),
    };
  });

  it("does not expose javascript links in the rendered DOM", () => {
    const { container } = render(
      <AgentMarkdown>[click me](javascript:alert(1))</AgentMarkdown>,
    );

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link).toHaveTextContent("click me");
    expect(link).not.toHaveAttribute("href");

    fireEvent.click(link!);
    expect(window.hermesAPI.openExternal).not.toHaveBeenCalled();
  });

  it("opens only absolute browser-safe links externally", () => {
    render(<AgentMarkdown>[docs](https://example.com/docs)</AgentMarkdown>);

    const link = screen.getByRole("link", { name: "docs" });
    expect(link).toHaveAttribute("href", "https://example.com/docs");

    fireEvent.click(link);
    expect(window.hermesAPI.openExternal).toHaveBeenCalledWith(
      "https://example.com/docs",
    );
  });

  it("classifies markdown hrefs conservatively", () => {
    expect(safeMarkdownExternalHref("https://example.com/a")).toBe(
      "https://example.com/a",
    );
    expect(safeMarkdownExternalHref("mailto:test@example.com")).toBe(
      "mailto:test@example.com",
    );
    expect(safeMarkdownExternalHref("/relative/path")).toBeUndefined();
    expect(safeMarkdownExternalHref("javascript:alert(1)")).toBeUndefined();
    expect(
      safeMarkdownExternalHref("data:text/html,<script>x</script>"),
    ).toBeUndefined();
  });
});
