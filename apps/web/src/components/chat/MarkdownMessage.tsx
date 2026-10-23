import React from 'react';

interface MarkdownMessageProps {
  content: string;
  onCitationClick?: (citationNumber: number) => void;
}

/**
 * Lightweight, dependency-free Markdown renderer tailored for AI copilot messages.
 * Supports headings, bullet lists, tables, blockquotes, bold/italic, code, and clickable citations.
 */
export const MarkdownMessage: React.FC<MarkdownMessageProps> = ({ content, onCitationClick }) => {
  const renderFormattedText = (text: string) => {
    // Replace citation markers like [^1], [^2], [1], [2] with interactive badges
    const parts: React.ReactNode[] = [];
    const citationRegex = /\[\^?(\d+)\]/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = citationRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(renderInlineStyles(text.slice(lastIndex, match.index), `${lastIndex}`));
      }
      const citNum = match[1] ? parseInt(match[1], 10) : 0;
      parts.push(
        <button
          key={`cit-${match.index}`}
          type="button"
          onClick={() => onCitationClick?.(citNum)}
          className="inline-flex items-center justify-center align-baseline relative -top-[1px] ml-1 mr-0.5 px-1.5 py-0.2 text-[10px] font-mono font-bold tracking-tight text-emerald-700 bg-emerald-50 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 rounded-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/50 hover:border-emerald-400 dark:hover:border-emerald-600 transition-colors cursor-pointer shadow-2xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500"
          title={`View Citation #${citNum}`}
        >
          [{citNum}]
        </button>,
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(renderInlineStyles(text.slice(lastIndex), `${lastIndex}`));
    }

    return parts.length > 0 ? parts : text;
  };

  const renderInlineStyles = (inlineText: string, keyPrefix: string): React.ReactNode => {
    // Process bold **text**, inline code `code`, and italics *text*
    const segments = inlineText.split(/(\*\*.*?\*\*|`.*?`|\*.*?\*)/g);

    return segments.map((seg, idx) => {
      const key = `${keyPrefix}-${idx}`;
      if (seg.startsWith('**') && seg.endsWith('**')) {
        return <strong key={key} className="font-semibold text-foreground">{seg.slice(2, -2)}</strong>;
      }
      if (seg.startsWith('`') && seg.endsWith('`')) {
        return (
          <code
            key={key}
            className="px-1 py-0.5 text-xs font-mono bg-muted/80 rounded text-foreground border border-border/40"
          >
            {seg.slice(1, -1)}
          </code>
        );
      }
      if (seg.startsWith('*') && seg.endsWith('*')) {
        return <em key={key} className="italic text-muted-foreground">{seg.slice(1, -1)}</em>;
      }
      return seg;
    });
  };

  // Split lines into structural blocks (paragraphs, headings, lists, tables, quotes)
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let tableRows: string[][] = [];
  let inTable = false;

  const flushTable = (tIndex: number) => {
    if (tableRows.length > 0 && tableRows[0]) {
      const headers = tableRows[0];
      const dataRows = tableRows.slice(1);
      elements.push(
        <div key={`table-${tIndex}`} className="overflow-x-auto my-3 border border-border rounded-md">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-muted/60 text-muted-foreground uppercase text-[10px] tracking-wider">
              <tr>
                {headers.map((h, hIdx) => (
                  <th key={`th-${hIdx}`} className="px-3 py-2 border-b border-border font-medium">
                    {renderFormattedText(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {dataRows.map((row, rIdx) => (
                <tr key={`tr-${rIdx}`} className="hover:bg-muted/30 transition-colors">
                  {row.map((cell, cIdx) => (
                    <td key={`td-${rIdx}-${cIdx}`} className="px-3 py-2 text-foreground/90">
                      {renderFormattedText(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      tableRows = [];
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    if (rawLine === undefined) continue;
    const line = rawLine.trim();

    // Table parsing: match outer pipes, support escaped pipes \| inside cells
    if (line.startsWith('|') && line.endsWith('|')) {
      // Check if separator line (| --- | --- |)
      if (/^\|[\s-:]+\|/.test(line)) {
        continue;
      }
      const cells = line
        .slice(1, -1)
        .split(/(?<!\\)\|/)
        .map((c) => c.replace(/\\\|/g, '|').trim());
      tableRows.push(cells);
      inTable = true;
      continue;
    } else if (inTable) {
      flushTable(i);
    }

    if (!line) {
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(
        <h3 key={`h3-${i}`} className="text-sm font-semibold text-foreground mt-3 mb-1.5 flex items-center gap-1.5">
          {renderFormattedText(line.slice(4))}
        </h3>,
      );
    } else if (line.startsWith('## ')) {
      elements.push(
        <h2 key={`h2-${i}`} className="text-base font-bold text-foreground mt-3.5 mb-2">
          {renderFormattedText(line.slice(3))}
        </h2>,
      );
    } else if (line.startsWith('# ')) {
      elements.push(
        <h1 key={`h1-${i}`} className="text-lg font-extrabold text-foreground mt-4 mb-2">
          {renderFormattedText(line.slice(2))}
        </h1>,
      );
    }
    // Blockquote
    else if (line.startsWith('> ')) {
      elements.push(
        <blockquote
          key={`quote-${i}`}
          className="border-l-2 border-primary/60 pl-3 my-2 text-xs italic text-muted-foreground bg-muted/20 py-1 rounded-r"
        >
          {renderFormattedText(line.slice(2))}
        </blockquote>,
      );
    }
    // Bullet item
    else if (line.startsWith('- ') || line.startsWith('* ')) {
      elements.push(
        <div key={`li-${i}`} className="flex items-start gap-2 my-1 text-xs text-foreground/90 pl-1">
          <span className="text-primary mt-1 text-[8px] shrink-0">•</span>
          <span className="leading-relaxed flex-1">{renderFormattedText(line.slice(2))}</span>
        </div>,
      );
    }
    // Numbered item
    else if (/^\d+\.\s+/.test(line)) {
      const match = line.match(/^(\d+)\.\s+(.*)$/);
      if (match) {
        elements.push(
          <div key={`ol-${i}`} className="flex items-start gap-2 my-1 text-xs text-foreground/90 pl-1">
            <span className="text-primary font-semibold text-[10px] min-w-[14px] shrink-0 mt-0.5">{match[1]}.</span>
            <span className="leading-relaxed flex-1">{renderFormattedText(match[2] ?? '')}</span>
          </div>,
        );
      }
    }
    // Standard paragraph
    else {
      elements.push(
        <p key={`p-${i}`} className="text-xs leading-relaxed text-foreground/90 my-1.5">
          {renderFormattedText(line)}
        </p>,
      );
    }
  }

  if (inTable) {
    flushTable(lines.length);
  }

  return <div className="space-y-1">{elements}</div>;
};
