import { describe, expect, it, vi } from "vitest";
import { CvFileRejected, readCvUpload } from "./cv-document";

vi.mock("server-only", () => ({}));

const PDF = "%PDF-1.7\n1 0 obj\n<< >>\nendobj\n%%EOF\n";
const pdfFile = (content: string) => new File([content], "cv.pdf", { type: "application/pdf" });

async function rejection(file: File) {
  const error = await readCvUpload(file).catch((e: unknown) => e);
  return error instanceof CvFileRejected ? error.code : error;
}

describe("readCvUpload", () => {
  it("sends a PDF to the model unchanged", async () => {
    const upload = await readCvUpload(pdfFile(PDF));
    expect(upload.document).toEqual({ kind: "pdf", base64: Buffer.from(PDF).toString("base64") });
  });

  it("drops bytes before a PDF header that starts late, as PDF readers allow", async () => {
    const plain = await readCvUpload(pdfFile(PDF));
    const prefixed = await readCvUpload(pdfFile(`\n${PDF}`));
    expect(prefixed.document).toEqual(plain.document);
    expect(prefixed.contentHash).toBe(plain.contentHash);
  });

  it("rejects a .pdf file without a header in its first 1024 bytes", async () => {
    expect(await rejection(pdfFile("<html>not a pdf</html>"))).toBe("file_type");
    expect(await rejection(pdfFile(" ".repeat(1024) + PDF))).toBe("file_type");
  });

  it("rejects unsupported types and empty text", async () => {
    expect(await rejection(new File(["x"], "cv.png", { type: "image/png" }))).toBe("file_type");
    expect(await rejection(new File(["  \n"], "cv.txt", { type: "text/plain" }))).toBe("empty_document");
  });
});
