import { describe, it, expect } from "vitest";
import { renderToString } from "react-dom/server";
import { parseTransTemplate, Trans } from "../Trans";

describe("parseTransTemplate", () => {
  it("returns a single text segment when no placeholders", () => {
    expect(parseTransTemplate("Hello world")).toEqual([
      { kind: "text", value: "Hello world" },
    ]);
  });
  it("parses a single <1>...</1> placeholder", () => {
    expect(parseTransTemplate("a <1>bold</1> b")).toEqual([
      { kind: "text", value: "a " },
      { kind: "slot", id: 1, content: "bold" },
      { kind: "text", value: " b" },
    ]);
  });
  it("parses multiple placeholders", () => {
    expect(parseTransTemplate("<1>one</1> and <2>two</2>")).toEqual([
      { kind: "slot", id: 1, content: "one" },
      { kind: "text", value: " and " },
      { kind: "slot", id: 2, content: "two" },
    ]);
  });
  it("leaves malformed tags as plain text", () => {
    const out = parseTransTemplate("a <1>x");
    const flat = out
      .map((s) => (s.kind === "text" ? s.value : `<${s.id}>${s.content}</${s.id}>`))
      .join("");
    expect(flat).toBe("a <1>x");
  });
});

describe("<Trans>", () => {
  it("renders wrappers around the slot content", () => {
    const html = renderToString(
      <Trans template="a <1>b</1> c" components={{ 1: <strong /> }} />,
    );
    expect(html).toContain("<strong");
    expect(html).toContain("b");
  });
});
