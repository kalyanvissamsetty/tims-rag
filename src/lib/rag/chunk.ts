const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 200;

export function normalizeText(value: string) {
  return value
    .replace(/\u0000/g, "") // remove NULL characters
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ") // remove other control chars, preserve tabs/newlines
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\t/g, "  ")
    .replace(/[ \u00A0]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkText(input: string, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) {
  const text = normalizeText(input);

  if (!text) {
    return [] as Array<{ content: string; tokenCount: number; order: number }>;
  }

  const chunks: Array<{ content: string; tokenCount: number; order: number }> = [];
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  let current = "";
  let order = 0;

  const pushChunk = (content: string) => {
    const slice = content.trim();

    if (!slice) return;

    chunks.push({
      content: slice,
      tokenCount: Math.ceil(slice.length / 4),
      order
    });
    order += 1;
  };

  const splitLargeBlock = (block: string) => {
    let index = 0;

    while (index < block.length) {
      const end = Math.min(index + chunkSize, block.length);
      const slice = block.slice(index, end).trim();

      if (slice) {
        pushChunk(slice);
      }

      if (end >= block.length) break;
      index = Math.max(end - overlap, index + 1);
    }
  };

  for (const block of blocks) {
    if (block.length > chunkSize) {
      if (current) {
        pushChunk(current);
        current = "";
      }
      splitLargeBlock(block);
      continue;
    }

    const next = current ? `${current}\n\n${block}` : block;

    if (next.length <= chunkSize) {
      current = next;
      continue;
    }

    pushChunk(current);

    if (block.length > chunkSize) {
      splitLargeBlock(block);
      current = "";
      continue;
    }

    current = block;
  }

  if (current) {
    pushChunk(current);
  }

  return chunks;
}
