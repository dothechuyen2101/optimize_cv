import localFont from "next/font/local";

// The face embedded in the PDF, so the preview looks like the download.
export const cvFont = localFont({
  src: [
    { path: "../../lib/export/fonts/BeVietnamPro-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../lib/export/fonts/BeVietnamPro-Bold.ttf", weight: "700", style: "normal" },
    { path: "../../lib/export/fonts/BeVietnamPro-Italic.ttf", weight: "400", style: "italic" },
  ],
  display: "swap",
});
