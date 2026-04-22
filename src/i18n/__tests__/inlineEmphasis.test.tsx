import { describe, it, expect } from "vitest";
import { isValidElement, type ReactElement } from "react";
import { renderInlineEmphasis } from "../inlineEmphasis";

describe("renderInlineEmphasis", () => {
  it("returns the whole string as a single text node when there are no markers", () => {
    const out = renderInlineEmphasis("plain text");
    expect(out).toEqual(["plain text"]);
  });

  it("splits text around a <1>...</1> marker and wraps the inner part in <strong>", () => {
    const out = renderInlineEmphasis("a <1>b</1> c");
    expect(out).toHaveLength(3);
    expect(out[0]).toBe("a ");
    expect(isValidElement(out[1])).toBe(true);
    expect((out[1] as { type: string }).type).toBe("strong");
    expect((out[1] as { props: { children: string } }).props.children).toBe("b");
    expect(out[2]).toBe(" c");
  });

  it("handles multiple numbered markers in one string", () => {
    const out = renderInlineEmphasis("<1>x</1> and <2>y</2>");
    const strongNodes = out.filter((n): n is ReactElement => isValidElement(n));
    expect(strongNodes).toHaveLength(2);
  });

  it("leaves unmatched markers as literal text (never breaks rendering)", () => {
    const out = renderInlineEmphasis("literal <1>open without close");
    expect(out).toEqual(["literal <1>open without close"]);
  });
});
