import "server-only";
import mammoth from "mammoth";
import { sha256Hex } from "@/lib/analysis/keys";

/** A resume ready to send to the model: PDFs go as-is so layout and scans survive. */
export type CvDocument = { kind: "pdf"; base64: string } | { kind: "text"; text: string };

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
  if (kind === "pdf") return { ...upload, document: { kind: "pdf", base64: buffer.toString("base64") } };

  const text = kind === "docx" ? await docxText(buffer) : buffer.toString("utf8");
  if (text.trim() === "") throw new CvFileRejected("empty_document");
  return { ...upload, document: { kind: "text", text } };
}
