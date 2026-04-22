import { cloneElement, Fragment, type ReactElement } from "react";

type Segment =
  | { kind: "text"; value: string }
  | { kind: "slot"; id: number; content: string };

const PATTERN = /<(\d+)>([\s\S]*?)<\/\1>/g;

export function parseTransTemplate(template: string): Segment[] {
  const out: Segment[] = [];
  let cursor = 0;
  for (const match of template.matchAll(PATTERN)) {
    const matchIndex = match.index ?? 0;
    if (matchIndex > cursor) {
      out.push({ kind: "text", value: template.slice(cursor, matchIndex) });
    }
    out.push({ kind: "slot", id: Number(match[1]), content: match[2] });
    cursor = matchIndex + match[0].length;
  }
  if (cursor < template.length) {
    out.push({ kind: "text", value: template.slice(cursor) });
  }
  return out;
}

interface TransProps {
  template: string;
  components: Record<number, ReactElement>;
}

export function Trans({ template, components }: TransProps) {
  const segments = parseTransTemplate(template);
  return (
    <>
      {segments.map((seg, i) => {
        if (seg.kind === "text") return <Fragment key={i}>{seg.value}</Fragment>;
        const wrapper = components[seg.id];
        if (!wrapper) return <Fragment key={i}>{seg.content}</Fragment>;
        return cloneElement(wrapper, { key: i }, seg.content);
      })}
    </>
  );
}
