export interface NormalizedDocumentPage {
  pageNumber: number;
  text: string;
}

export class DocumentContentNormalizer {
  /**
   * Normalizes raw document text or buffers into clean, structured page representations
   * with guaranteed page numbers and sanitized text blocks.
   */
  public normalize(content: string | Buffer): NormalizedDocumentPage[] {
    const rawText = typeof content === 'string' ? content : content.toString('utf-8');

    if (!rawText || rawText.trim() === '') {
      return [{ pageNumber: 1, text: 'Empty Document' }];
    }

    // 1. Check for form feed character '\f' (standard PDF page separator)
    if (rawText.includes('\f')) {
      const rawPages = rawText.split('\f');
      const filtered = rawPages
        .map((p) => p.trim())
        .filter((p) => p.length > 0)
        .map((text, idx) => ({
          pageNumber: idx + 1,
          text: this.sanitizePageText(text),
        }));

      if (filtered.length > 0) {
        return filtered;
      }
    }

    // 2. Check for explicit Page markers (e.g. "--- PAGE 1 ---" or "[PAGE 1]")
    const pageMarkerRegex = /(?:---|\[)\s*PAGE\s+(\d+)\s*(?:---|\])/i;
    if (pageMarkerRegex.test(rawText)) {
      const parts = rawText.split(/(?:---|\[)\s*PAGE\s+\d+\s*(?:---|\])/i);
      const matches = Array.from(rawText.matchAll(/(?:---|\[)\s*PAGE\s+(\d+)\s*(?:---|\])/gi));

      const pages: NormalizedDocumentPage[] = [];
      for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        if (!match || !match[1]) continue;
        const pageNum = parseInt(match[1], 10);
        const text = parts[i + 1]?.trim();
        if (text && text.length > 0) {
          pages.push({
            pageNumber: pageNum,
            text: this.sanitizePageText(text),
          });
        }
      }

      if (pages.length > 0) {
        return pages;
      }
    }

    // 3. Fallback: Single-page normalization
    return [
      {
        pageNumber: 1,
        text: this.sanitizePageText(rawText),
      },
    ];
  }

  private sanitizePageText(text: string): string {
    // Strip null bytes and non-printable control characters, normalize line breaks
    return text
      .replace(/\0/g, '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .trim();
  }
}
