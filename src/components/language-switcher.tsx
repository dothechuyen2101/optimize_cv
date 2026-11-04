"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";

/** Links to the other locale: `href` when known, otherwise that locale's home page. */
export function LanguageSwitcherLink({ locale, label, href }: { locale: Locale; label: string; href: string | null }) {
  const target: Locale = locale === "vi" ? "en" : "vi";
  return (
    <Link
      href={href ?? `/${target}`}
      hrefLang={target}
      aria-label={label}
      className="ml-1 rounded-lg border border-line px-2 py-1.5 font-medium whitespace-nowrap text-subtle hover:border-primary/40 hover:bg-soft hover:text-foreground sm:px-3"
    >
      {/* Phones have no room for the name next to the signed-in links. */}
      <span className="sm:hidden">{target.toUpperCase()}</span>
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

/** Same page in the other locale. */
export function LanguageSwitcher({ locale, label }: { locale: Locale; label: string }) {
  const pathname = usePathname();
  const target: Locale = locale === "vi" ? "en" : "vi";
  return (
    <LanguageSwitcherLink locale={locale} label={label} href={pathname.replace(/^\/(vi|en)(?=\/|$)/, `/${target}`)} />
  );
}
