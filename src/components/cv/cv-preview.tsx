import localFont from "next/font/local";
import { WithPlaceholders } from "@/components/analyze/with-placeholders";
import type { CvDocument, CvLine } from "@/lib/export/document";

// The face embedded in the PDF, so the preview looks like the download.
const cvFont = localFont({
  src: [
    { path: "../../lib/export/fonts/BeVietnamPro-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../lib/export/fonts/BeVietnamPro-Bold.ttf", weight: "700", style: "normal" },
    { path: "../../lib/export/fonts/BeVietnamPro-Italic.ttf", weight: "400", style: "italic" },
  ],
  display: "swap",
});

function Line({ line }: { line: CvLine }) {
  return (
    <span className={line.changed ? "-mx-1 box-decoration-clone rounded bg-emerald-100 px-1" : undefined}>
      <WithPlaceholders text={line.text} className="bg-amber-200 text-amber-900" />
    </span>
  );
}

/** The exported CV as HTML: a white page in light and dark mode alike, like the file it previews. */
export function CvPreview({ doc }: { doc: CvDocument }) {
  return (
    <article
      lang={doc.language}
      className={`${cvFont.className} mx-auto w-full max-w-[210mm] rounded-sm bg-white px-6 py-8 text-[13px] leading-[1.45] text-neutral-800 shadow-sm ring-1 ring-black/5 sm:px-12 sm:py-12`}
    >
      {doc.name && <h2 className="text-center text-2xl font-bold text-neutral-900">{doc.name}</h2>}
      {doc.headline && <p className="mt-0.5 text-center text-sm">{doc.headline}</p>}
      {doc.contact.length > 0 && (
        <p className="mt-1.5 break-words text-center text-xs text-neutral-600">{doc.contact.join("  ·  ")}</p>
      )}
      {doc.sections.map((section, index) => (
        <section key={index} className="mt-5">
          <h3 className="mb-2 border-b border-neutral-400 pb-0.5 text-[13.5px] font-bold uppercase tracking-wide text-neutral-900">
            {section.heading}
          </h3>
          {section.entries.map((entry, entryIndex) => (
            <div key={entryIndex} className="mb-3 last:mb-0">
              {(entry.title || entry.dates) && (
                <div className="flex flex-wrap justify-between gap-x-4">
                  <span className="font-bold">{entry.title}</span>
                  {entry.dates && <span className="text-neutral-600">{entry.dates}</span>}
                </div>
              )}
              {entry.subtitle && <p className="italic text-neutral-700">{entry.subtitle}</p>}
              {entry.paragraphs.map((paragraph, i) => (
                <p key={i} className="mt-0.5">
                  <Line line={paragraph} />
                </p>
              ))}
              {entry.bullets.length > 0 && (
                <ul className="mt-0.5 list-disc pl-5">
                  {entry.bullets.map((bullet, i) => (
                    <li key={i} className="mt-0.5">
                      <Line line={bullet} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      ))}
    </article>
  );
}
