import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { hasLocale, locales } from "@/i18n/config";
import { dictionaryFor } from "@/i18n/get-dictionary";

// Rendered at build time for both languages, so the fonts are only read during the build.
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export const alt = "OptimizeCV";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// The default font has no Vietnamese diacritics; reuse the face embedded in exported CVs.
const fontDir = join(process.cwd(), "src/lib/export/fonts");
const [regular, bold] = await Promise.all([
  readFile(join(fontDir, "BeVietnamPro-Regular.ttf")),
  readFile(join(fontDir, "BeVietnamPro-Bold.ttf")),
]);

export default async function OpenGraphImage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const { home, nav } = await dictionaryFor(hasLocale(lang) ? lang : "vi");
  const features = (["tailor", "role", "interview", "portfolio"] as const).map((key) => home.features[key].title);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #312e81 0%, #4338ca 55%, #6366f1 100%)",
          color: "white",
          fontFamily: "Be Vietnam Pro",
        }}
      >
        <div style={{ display: "flex", fontSize: 34, fontWeight: 700, opacity: 0.95 }}>{nav.brand}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ display: "flex", fontSize: 60, fontWeight: 700, lineHeight: 1.15, maxWidth: 1000 }}>{`${home.titleLead} ${home.titleAccent}`}</div>
          <div style={{ display: "flex", fontSize: 28, lineHeight: 1.4, opacity: 0.85, maxWidth: 980 }}>{home.eyebrow}</div>
        </div>
        <div style={{ display: "flex", gap: 14 }}>
          {features.map((feature) => (
            <div
              key={feature}
              style={{
                display: "flex",
                padding: "10px 20px",
                borderRadius: 999,
                background: "rgba(255,255,255,0.16)",
                fontSize: 24,
              }}
            >
              {feature}
            </div>
          ))}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Be Vietnam Pro", data: regular, style: "normal", weight: 400 },
        { name: "Be Vietnam Pro", data: bold, style: "normal", weight: 700 },
      ],
    },
  );
}
