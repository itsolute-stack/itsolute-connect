import type { ReactNode } from "react";

// A small, dependency-free Markdown renderer for our own controlled content
// (the onboarding playbook). Supports the subset we actually write: headings,
// paragraphs, ordered/unordered lists, tables, blockquotes, horizontal rules,
// fenced code blocks, and inline **bold**, `code`, *italic*, and [links](url).
// Not a general-purpose parser — it only has to render files we author.

const INLINE = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|\*([^*]+)\*)/g;

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  INLINE.lastIndex = 0;
  while ((m = INLINE.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const key = `${keyPrefix}-${i++}`;
    if (m[2] !== undefined) out.push(<strong key={key}>{m[2]}</strong>);
    else if (m[3] !== undefined)
      out.push(
        <code key={key} className="rounded bg-black/[0.06] px-1.5 py-0.5 font-mono text-[0.85em]">
          {m[3]}
        </code>,
      );
    else if (m[4] !== undefined)
      out.push(
        <a key={key} href={m[5]} className="text-[var(--color-brand-700)] underline underline-offset-2">
          {m[4]}
        </a>,
      );
    else if (m[6] !== undefined) out.push(<em key={key}>{m[6]}</em>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());
}

const isTableSep = (line: string) => /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(line) && line.includes("-");

export function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  const k = () => `b${key++}`;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Fenced code block
    if (line.trim().startsWith("```")) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith("```")) buf.push(lines[i++]);
      i++; // closing fence
      blocks.push(
        <pre key={k()} className="overflow-x-auto rounded-lg bg-[var(--color-ink)] p-4 text-sm text-white">
          <code className="font-mono">{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      blocks.push(<hr key={k()} className="my-8 border-[var(--color-line)]" />);
      i++;
      continue;
    }

    // Heading
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const content = inline(h[2], k());
      const cls =
        level === 1
          ? "mt-2 mb-4 text-2xl font-bold tracking-tight"
          : level === 2
            ? "mt-10 mb-3 border-b border-[var(--color-line)] pb-2 text-xl font-semibold"
            : "mt-6 mb-2 text-base font-semibold text-[var(--color-ink-soft)]";
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      blocks.push(
        <Tag key={k()} className={cls}>
          {content}
        </Tag>,
      );
      i++;
      continue;
    }

    // Table
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      const header = splitRow(line);
      i += 2; // header + separator
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push(
        <div key={k()} className="my-4 overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[var(--color-line)] text-left">
                {header.map((c, ci) => (
                  <th key={ci} className="px-3 py-2 font-semibold align-top">
                    {inline(c, `th${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-[var(--color-line)] align-top">
                  {r.map((c, ci) => (
                    <td key={ci} className="px-3 py-2">
                      {inline(c, `td${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Blockquote
    if (line.startsWith(">")) {
      const buf: string[] = [];
      while (i < lines.length && lines[i].startsWith(">")) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={k()}
          className="my-4 rounded-r-lg border-l-4 border-[var(--color-brand-600)] bg-[var(--color-brand-50,rgba(0,0,0,0.03))] px-4 py-3 text-[var(--color-ink-soft)]"
        >
          {inline(buf.join(" "), k())}
        </blockquote>,
      );
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i++;
      }
      blocks.push(
        <ol key={k()} className="my-3 list-decimal space-y-1.5 pl-6">
          {items.map((it, ii) => (
            <li key={ii}>{inline(it, `oli${ii}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // Unordered list
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={k()} className="my-3 list-disc space-y-1.5 pl-6">
          {items.map((it, ii) => (
            <li key={ii}>{inline(it, `uli${ii}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // Paragraph — gather contiguous plain lines
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].trim().startsWith("```") &&
      !/^---+$/.test(lines[i].trim()) &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !lines[i].startsWith(">") &&
      !/^\d+\.\s+/.test(lines[i]) &&
      !/^[-*]\s+/.test(lines[i]) &&
      !(lines[i].includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1]))
    ) {
      para.push(lines[i]);
      i++;
    }
    if (para.length) {
      blocks.push(
        <p key={k()} className="my-3 leading-relaxed text-[var(--color-ink)]">
          {inline(para.join(" "), k())}
        </p>,
      );
    }
  }

  return <div className="text-[0.95rem] text-[var(--color-ink)]">{blocks}</div>;
}
