import type { ReactNode } from "react";

const MARKER_RE = /<(\d+)>([\s\S]*?)<\/\1>/g;

/**
 * Parses `<1>inner</1>` / `<2>inner</2>` markers in translated strings and
 * returns a React node array with the inner parts wrapped in <strong>.
 * Plain text outside markers is returned as-is (React escapes it automatically).
 * Safer than HTML-string helpers because no raw HTML is ever produced.
 */
export function renderInlineEmphasis(template: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let keyCounter = 0;
  for (const match of template.matchAll(MARKER_RE)) {
    const start = match.index ?? 0;
    if (start > lastIndex) nodes.push(template.slice(lastIndex, start));
    nodes.push(<strong key={`em-${keyCounter++}`}>{match[2]}</strong>);
    lastIndex = start + match[0].length;
  }
  if (lastIndex === 0) return [template];
  if (lastIndex < template.length) nodes.push(template.slice(lastIndex));
  return nodes;
}
