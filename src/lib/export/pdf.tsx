import "server-only";
import path from "node:path";
import { Document, Font, Page, StyleSheet, Text, View, renderToBuffer } from "@react-pdf/renderer";
import type { CvDocument, CvEntry } from "./document";

// The built-in PDF fonts have no Vietnamese diacritics, so a TTF is embedded.
// next.config.ts traces this folder into the export route.
const FONT_DIR = path.join(process.cwd(), "src/lib/export/fonts");
const FAMILY = "Be Vietnam Pro";

Font.register({
  family: FAMILY,
  fonts: [
    { src: path.join(FONT_DIR, "BeVietnamPro-Regular.ttf") },
    { src: path.join(FONT_DIR, "BeVietnamPro-Bold.ttf"), fontWeight: "bold" },
    { src: path.join(FONT_DIR, "BeVietnamPro-Italic.ttf"), fontStyle: "italic" },
  ],
});
// Hyphenated names, skills and Vietnamese syllables read badly; wrap whole words only.
Font.registerHyphenationCallback((word) => [word]);

const styles = StyleSheet.create({
  page: { paddingVertical: 40, paddingHorizontal: 44, fontFamily: FAMILY, fontSize: 10, lineHeight: 1.4, color: "#1f2937" },
  // The page's line height resolves to points at 10pt, so larger text sets its own.
  name: { fontSize: 20, lineHeight: 1.3, fontWeight: "bold", textAlign: "center", color: "#111827" },
  headline: { fontSize: 11, textAlign: "center", marginTop: 2 },
  contact: { fontSize: 9, textAlign: "center", marginTop: 4, color: "#4b5563" },
  section: { marginTop: 14 },
  heading: {
    fontSize: 10.5,
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#111827",
    borderBottomWidth: 0.75,
    borderBottomColor: "#9ca3af",
    paddingBottom: 2,
    marginBottom: 6,
  },
  entry: { marginBottom: 8 },
  entryHead: { flexDirection: "row", justifyContent: "space-between" },
  title: { fontWeight: "bold", flexShrink: 1, paddingRight: 12 },
  dates: { color: "#4b5563" },
  subtitle: { fontStyle: "italic", color: "#374151" },
  paragraph: { marginTop: 2 },
  bullet: { flexDirection: "row", marginTop: 2 },
  bulletMark: { width: 10 },
  bulletText: { flex: 1 },
});

function Entry({ entry }: { entry: CvEntry }) {
  return (
    <View style={styles.entry}>
      {(entry.title.text || entry.dates.text || entry.subtitle.text) && (
        <View wrap={false}>
          {(entry.title.text || entry.dates.text) && (
            <View style={styles.entryHead}>
              <Text style={styles.title}>{entry.title.text}</Text>
              {entry.dates.text && <Text style={styles.dates}>{entry.dates.text}</Text>}
            </View>
          )}
          {entry.subtitle.text && <Text style={styles.subtitle}>{entry.subtitle.text}</Text>}
        </View>
      )}
      {entry.paragraphs.map((paragraph, index) => (
        <Text key={index} style={styles.paragraph}>
          {paragraph.text}
        </Text>
      ))}
      {entry.bullets.map((bullet, index) => (
        <View key={index} style={styles.bullet} wrap={false}>
          <Text style={styles.bulletMark}>•</Text>
          <Text style={styles.bulletText}>{bullet.text}</Text>
        </View>
      ))}
    </View>
  );
}

/** Renders a pruned document (see pruneEmpty). */
export function renderCvPdf(doc: CvDocument): Promise<Buffer> {
  return renderToBuffer(
    <Document title={doc.name.text ? `CV - ${doc.name.text}` : "CV"} author={doc.name.text || undefined} creator="OptimizeCV" language={doc.language}>
      <Page size="A4" style={styles.page}>
        {doc.name.text && <Text style={styles.name}>{doc.name.text}</Text>}
        {doc.headline.text && <Text style={styles.headline}>{doc.headline.text}</Text>}
        {doc.contact.length > 0 && <Text style={styles.contact}>{doc.contact.map((c) => c.text).join("  ·  ")}</Text>}
        {doc.sections.map((section, index) => (
          <View key={index} style={styles.section}>
            <Text style={styles.heading} minPresenceAhead={40}>
              {section.heading}
            </Text>
            {section.entries.map((entry, index) => (
              <Entry key={index} entry={entry} />
            ))}
          </View>
        ))}
      </Page>
    </Document>
  );
}
