import JSZip from "jszip";
import mammoth from "mammoth";
import pdf from "pdf-parse";

import { normalizeText } from "@/lib/rag/chunk";
import { extractTextWithManagedLayout, extractTextWithManagedOcr } from "@/lib/rag/openai";
import type { DocumentMetadata } from "@/types";

type ExtractionResult = {
  text: string;
  metadata: DocumentMetadata;
};

const OCR_TEXT_THRESHOLD = 250;

function getExtension(file: File) {
  return file.name.toLowerCase().split(".").pop() ?? "";
}

function isPdf(file: File) {
  return file.type === "application/pdf" || getExtension(file) === "pdf";
}

function isDocx(file: File) {
  return (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    getExtension(file) === "docx"
  );
}

function isPptx(file: File) {
  return (
    file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    getExtension(file) === "pptx"
  );
}

function isImage(file: File) {
  return file.type.startsWith("image/");
}

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtml(value: string) {
  return normalizeText(
    decodeHtmlEntities(
      value
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/p>/gi, "\n")
        .replace(/<\/li>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

function htmlTableToMarkdown(tableHtml: string) {
  const rowMatches = Array.from(tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi));
  const rows = rowMatches
    .map((row) =>
      Array.from(row[1].matchAll(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi))
        .map((cell) => stripHtml(cell[1]).replace(/\|/g, "\\|"))
        .filter(Boolean)
    )
    .filter((cells) => cells.length);

  if (!rows.length) {
    return "";
  }

  const header = rows[0];
  const separator = header.map(() => "---");
  const body = rows.slice(1);
  const lines = [
    `| ${header.join(" | ")} |`,
    `| ${separator.join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`)
  ];

  return lines.join("\n");
}

function convertDocxHtmlToStructuredText(html: string) {
  const sections: string[] = [];
  const tableBlocks = new Map<string, string>();
  let tableIndex = 0;

  const htmlWithTableMarkers = html.replace(/<table\b[\s\S]*?<\/table>/gi, (table) => {
    const marker = `__TABLE_${tableIndex}__`;
    tableBlocks.set(marker, htmlTableToMarkdown(table));
    tableIndex += 1;
    return `</p>${marker}<p>`;
  });

  const blockMatches = Array.from(
    htmlWithTableMarkers.matchAll(/<(h[1-6]|p|li)\b[^>]*>([\s\S]*?)<\/\1>/gi)
  );

  for (const [, tag, content] of blockMatches) {
    const clean = stripHtml(content);

    if (!clean) continue;

    if (tableBlocks.has(clean)) {
      sections.push(tableBlocks.get(clean)!);
      continue;
    }

    if (tag.startsWith("h")) {
      const level = Number(tag[1]);
      sections.push(`${"#".repeat(Math.min(level, 3))} ${clean}`);
      continue;
    }

    if (tag === "li") {
      sections.push(`- ${clean}`);
      continue;
    }

    sections.push(clean);
  }

  for (const [marker, markdownTable] of tableBlocks) {
    if (markdownTable && !sections.includes(markdownTable) && htmlWithTableMarkers.includes(marker)) {
      sections.push(markdownTable);
    }
  }

  return normalizeText(sections.join("\n\n"));
}

async function extractNativePdfText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await pdf(buffer);
  return normalizeText(parsed.text);
}

async function extractDocxStructuredText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const parsed = await mammoth.convertToHtml({ buffer });
  return convertDocxHtmlToStructuredText(parsed.value);
}

function extractXmlTextNodes(xml: string) {
  return Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g))
    .map((match) => decodeHtmlEntities(match[1]))
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function extractPptxTableMarkdown(xml: string) {
  const tables = Array.from(xml.matchAll(/<a:tbl\b[\s\S]*?<\/a:tbl>/g));

  return tables
    .map((tableMatch) => {
      const rows = Array.from(tableMatch[0].matchAll(/<a:tr\b[\s\S]*?<\/a:tr>/g))
        .map((rowMatch) =>
          Array.from(rowMatch[0].matchAll(/<a:tc\b[\s\S]*?<\/a:tc>/g))
            .map((cellMatch) => normalizeText(extractXmlTextNodes(cellMatch[0]).join(" ")).replace(/\|/g, "\\|"))
            .filter(Boolean)
        )
        .filter((row) => row.length);

      if (!rows.length) return "";

      const header = rows[0];
      const separator = header.map(() => "---");

      return [
        `| ${header.join(" | ")} |`,
        `| ${separator.join(" | ")} |`,
        ...rows.slice(1).map((row) => `| ${row.join(" | ")} |`)
      ].join("\n");
    })
    .filter(Boolean);
}

async function extractPptxText(file: File) {
  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const slideEntries = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name))
    .sort((left, right) => {
      const leftNumber = Number(left.match(/slide(\d+)\.xml/i)?.[1] ?? "0");
      const rightNumber = Number(right.match(/slide(\d+)\.xml/i)?.[1] ?? "0");
      return leftNumber - rightNumber;
    });

  const slides: string[] = [];

  for (const [index, entryName] of slideEntries.entries()) {
    const xml = await zip.file(entryName)?.async("text");

    if (!xml) continue;

    const tableMarkdown = extractPptxTableMarkdown(xml);
    const xmlWithoutTables = xml.replace(/<a:tbl\b[\s\S]*?<\/a:tbl>/g, " ");
    const textNodes = extractXmlTextNodes(xmlWithoutTables);
    const uniqueLines = textNodes.filter((value, valueIndex) => textNodes.indexOf(value) === valueIndex);
    const slideParts = [`## Slide ${index + 1}`];

    if (uniqueLines.length) {
      slideParts.push(uniqueLines.join("\n"));
    }

    if (tableMarkdown.length) {
      slideParts.push(...tableMarkdown);
    }

    slides.push(slideParts.join("\n\n"));
  }

  return normalizeText(slides.join("\n\n"));
}

async function extractPlainText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  return normalizeText(buffer.toString("utf-8"));
}

function buildMetadata(
  extractionMethod: DocumentMetadata["extraction_method"],
  reason: string | null,
  extra?: Partial<DocumentMetadata>
): DocumentMetadata {
  return {
    extraction_method: extractionMethod,
    extraction_reason: reason,
    extraction_confidence: "high",
    ocr_model: null,
    ...extra
  };
}

export async function extractDocumentText(file: File): Promise<ExtractionResult> {
  if (isImage(file)) {
    const ocr = await extractTextWithManagedOcr(file);
    return {
      text: normalizeText(ocr.text),
      metadata: buildMetadata("ocr", "Image uploads require OCR.", {
        ocr_model: ocr.model,
        layout_preserved: true
      })
    };
  }

  if (isPdf(file)) {
    try {
      const structured = await extractTextWithManagedLayout(file, "pdf");

      if (normalizeText(structured.text).length >= OCR_TEXT_THRESHOLD) {
        return {
          text: normalizeText(structured.text),
          metadata: buildMetadata("structured", "Managed document extraction preserved table layout.", {
            ocr_model: structured.model,
            layout_preserved: true,
            parser: "openai-file-layout"
          })
        };
      }
    } catch {
      // Fall through to native extraction.
    }

    const nativeText = await extractNativePdfText(file);

    if (nativeText.length >= OCR_TEXT_THRESHOLD) {
      return {
        text: nativeText,
        metadata: buildMetadata("native", "Native PDF extraction used as fallback.", {
          layout_preserved: false,
          parser: "pdf-parse"
        })
      };
    }

    throw new Error("PDF text extraction returned too little text. This PDF may be scanned/image-based or structurally complex.");
  }

  if (isDocx(file)) {
    const structuredDocx = await extractDocxStructuredText(file);

    if (structuredDocx) {
      return {
        text: structuredDocx,
        metadata: buildMetadata("structured", "Word extraction preserved headings and table layout.", {
          layout_preserved: true,
          parser: "mammoth-html"
        })
      };
    }

    const managed = await extractTextWithManagedLayout(file, "office");

    return {
      text: normalizeText(managed.text),
      metadata: buildMetadata("structured", "Managed document extraction used for Word document.", {
        layout_preserved: true,
        parser: "openai-file-layout",
        ocr_model: managed.model
      })
    };
  }

  if (isPptx(file)) {
    const slideText = await extractPptxText(file);

    if (slideText) {
      return {
        text: slideText,
        metadata: buildMetadata("structured", "Presentation extraction preserved slide sections and tables.", {
          layout_preserved: true,
          parser: "pptx-xml"
        })
      };
    }

    const managed = await extractTextWithManagedLayout(file, "office");

    return {
      text: normalizeText(managed.text),
      metadata: buildMetadata("structured", "Managed document extraction used for presentation.", {
        layout_preserved: true,
        parser: "openai-file-layout",
        ocr_model: managed.model
      })
    };
  }

  return {
    text: await extractPlainText(file),
    metadata: buildMetadata("native", null, {
      layout_preserved: false,
      parser: "plain-text"
    })
  };
}
