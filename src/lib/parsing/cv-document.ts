import "server-only";
import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import { sha256Hex } from "@/lib/analysis/keys";

/**
 * A resume ready to send to the model. PDFs go as-is so layout and scans survive,
 * along with their own text layer: the exact characters, which the model would
 * otherwise read off page images and sometimes get wrong.
 */
export type CvDocument = { kind: "pdf"; base64: string; text: string | null } | { kind: "text"; text: string };

export const MAX_CV_BYTES = 5 * 1024 * 1024;

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type CvFileError = "file_type" | "file_too_large" | "empty_document";

export class CvFileRejected extends Error {
  constructor(readonly code: CvFileError) {
    super(code);
    this.name = "CvFileRejected";
  }
}

function kindOf(file: File): "pdf" | "docx" | "txt" | null {
  const name = file.name.toLowerCase();
  if (file.type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (file.type === DOCX_MIME || name.endsWith(".docx")) return "docx";
  if (file.type === "text/plain" || name.endsWith(".txt")) return "txt";
  return null;
}

/** PDF readers accept a header anywhere in the first 1024 bytes, so some real files start with junk. */
const PDF_HEADER_WINDOW = 1024;

function pdfBytes(buffer: Buffer): Buffer {
  const start = buffer.subarray(0, PDF_HEADER_WINDOW).indexOf("%PDF-", 0, "latin1");
  if (start === -1) throw new CvFileRejected("file_type");
  // Such files count xref offsets from the header, so cutting the prefix leaves a well-formed PDF.
  return buffer.subarray(start);
}

// A real text layer has hundreds of letters even on a short resume; scans have none or a few stray ones.
const MIN_TEXT_LAYER_LETTERS = 150;
const MAX_TEXT_LAYER_CHARS = 40_000;

/** The PDF's page count and text layer; the text is null for scans and layers too garbled to trust. */
async function pdfTextLayer(buffer: Buffer): Promise<{ text: string | null; pages: number | null }> {
  try {
    // Copied, since pdf.js may detach the buffer it is given.
    const extracted = await extractText(await getDocumentProxy(new Uint8Array(buffer)), { mergePages: true });
    const pages = extracted.totalPages;
    // Glyphs without a Unicode mapping (often ligatures like "ffi") come out as control characters;
    // mark them so the model reads those letters off the page instead.
    const text = extracted.text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "\uFFFD");
    const letters = text.match(/\p{L}/gu)?.length ?? 0;
    const garbled = text.match(/[\uFFFD\uE000-\uF8FF]/g)?.length ?? 0;
    if (letters < MIN_TEXT_LAYER_LETTERS || garbled > letters * 0.05) return { text: null, pages };
    return { text: text.slice(0, MAX_TEXT_LAYER_CHARS), pages };
  } catch (error) {
    // The model can still read the pages, just less accurately.
    console.warn("[cv] PDF text layer extraction failed", error);
    return { text: null, pages: null };
  }
}

/** The model reads at most this many PDF pages per request. */
export const MAX_PDF_PAGES = 100;

/** Any PDF upload (e.g. a portfolio) prepared like a CV's: trimmed bytes, text layer and page count. */
export async function readPdfFile(file: File, maxBytes: number) {
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) throw new CvFileRejected("file_type");
  if (file.size > maxBytes) throw new CvFileRejected("file_too_large");
  const buffer = pdfBytes(Buffer.from(await file.arrayBuffer()));
  const { text, pages } = await pdfTextLayer(buffer);
  return { base64: buffer.toString("base64"), text, pages, fileName: file.name };
}

async function docxText(buffer: Buffer): Promise<string> {
  try {
    return (await mammoth.extractRawText({ buffer })).value;
  } catch {
    // Corrupted file, or not really a DOCX despite the extension.
    throw new CvFileRejected("empty_document");
  }
}

export interface CvUpload {
  document: CvDocument;
  /** sha256 of the raw file: the same file uploaded again reuses its parse. */
  contentHash: string;
  fileName: string;
}

export async function readCvUpload(file: File): Promise<CvUpload> {
  const kind = kindOf(file);
  if (!kind) throw new CvFileRejected("file_type");
  if (file.size > MAX_CV_BYTES) throw new CvFileRejected("file_too_large");

  const raw = Buffer.from(await file.arrayBuffer());
  const buffer = kind === "pdf" ? pdfBytes(raw) : raw;
  const upload = { contentHash: sha256Hex(buffer), fileName: file.name };
  if (kind === "pdf") {
    const { text } = await pdfTextLayer(buffer);
    return { ...upload, document: { kind: "pdf", base64: buffer.toString("base64"), text } };
  }

  const text = kind === "docx" ? await docxText(buffer) : buffer.toString("utf8");
  if (text.trim() === "") throw new CvFileRejected("empty_document");
  return { ...upload, document: { kind: "text", text } };
}
