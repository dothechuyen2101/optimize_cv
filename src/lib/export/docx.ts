import { AlignmentType, BorderStyle, Document, Packer, Paragraph, Tab, TabStopType, TextRun } from "docx";
import type { CvDocument, CvEntry } from "./document";

// Word can't rely on an embedded font, so use one every machine has that covers Vietnamese.
const FONT = "Arial";
// A4 with 0.5" margins, in twentieths of a point.
const PAGE = { width: 11906, height: 16838, margin: 720 };
const CONTENT_WIDTH = PAGE.width - 2 * PAGE.margin;
const MUTED = "4B5563";

function entryParagraphs(entry: CvEntry): Paragraph[] {
  const paragraphs: Paragraph[] = [];
  if (entry.title.text || entry.dates.text) {
    paragraphs.push(
      new Paragraph({
        keepNext: true,
        spacing: { before: 120 },
        tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_WIDTH }],
        children: [
          new TextRun({ text: entry.title.text, bold: true }),
          ...(entry.dates.text ? [new TextRun({ children: [new Tab(), entry.dates.text], color: MUTED })] : []),
        ],
      }),
    );
  }
  if (entry.subtitle.text) {
    paragraphs.push(new Paragraph({ keepNext: true, children: [new TextRun({ text: entry.subtitle.text, italics: true })] }));
  }
  for (const paragraph of entry.paragraphs) {
    paragraphs.push(new Paragraph({ spacing: { before: 40 }, children: [new TextRun(paragraph.text)] }));
  }
  for (const bullet of entry.bullets) {
    paragraphs.push(new Paragraph({ bullet: { level: 0 }, spacing: { before: 40 }, children: [new TextRun(bullet.text)] }));
  }
  return paragraphs;
}

/** Renders a pruned document (see pruneEmpty). */
export function renderCvDocx(doc: CvDocument): Promise<Buffer> {
  const centered = (run: TextRun, before = 0) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before }, children: [run] });
  const header = [
    ...(doc.name.text ? [centered(new TextRun({ text: doc.name.text, bold: true, size: 36 }))] : []),
    ...(doc.headline.text ? [centered(new TextRun({ text: doc.headline.text, size: 22 }), 40)] : []),
    ...(doc.contact.length > 0
      ? [centered(new TextRun({ text: doc.contact.map((c) => c.text).join("  ·  "), size: 18, color: MUTED }), 80)]
      : []),
  ];
  const body = doc.sections.flatMap((section) => [
    new Paragraph({
      keepNext: true,
      spacing: { before: 280, after: 80 },
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "9CA3AF", space: 1 } },
      children: [new TextRun({ text: section.heading, bold: true, allCaps: true, size: 21 })],
    }),
    ...section.entries.flatMap(entryParagraphs),
  ]);

  const document = new Document({
    creator: "OptimizeCV",
    title: doc.name.text ? `CV - ${doc.name.text}` : "CV",
    styles: { default: { document: { run: { font: FONT, size: 20 } } } },
    sections: [
      {
        properties: {
          page: {
            size: { width: PAGE.width, height: PAGE.height },
            margin: { top: PAGE.margin, bottom: PAGE.margin, left: PAGE.margin, right: PAGE.margin },
          },
        },
        children: [...header, ...body],
      },
    ],
  });
  return Packer.toBuffer(document);
}
