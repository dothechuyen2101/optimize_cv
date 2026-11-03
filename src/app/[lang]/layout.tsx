import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { locales } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { siteUrl } from "@/lib/site";
import "../globals.css";

// Inter ships a Vietnamese subset, so diacritics don't fall back to another font.
const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-inter" });

export async function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const dict = await getDictionary();
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: dict.meta.title, template: `%s · ${dict.nav.brand}` },
    description: dict.meta.description,
    openGraph: {
      type: "website",
      siteName: dict.nav.brand,
      title: dict.meta.title,
      description: dict.meta.description,
      locale: locale === "vi" ? "vi_VN" : "en_US",
      alternateLocale: locale === "vi" ? "en_US" : "vi_VN",
    },
    twitter: { card: "summary_large_image", title: dict.meta.title, description: dict.meta.description },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const locale = await getLocale();
  const dict = await getDictionary();

  return (
    <html lang={locale} className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <SiteHeader locale={locale} nav={dict.nav} />
        <main className="flex-1">{children}</main>
        <SiteFooter locale={locale} nav={dict.nav} footer={dict.footer} />
      </body>
    </html>
  );
}
