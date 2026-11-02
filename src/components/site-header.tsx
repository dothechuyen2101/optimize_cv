import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { LanguageSwitcher, LanguageSwitcherLink } from "./language-switcher";
import { UserNav } from "./user-nav";

export function SiteHeader({ locale, nav }: { locale: Locale; nav: Dictionary["nav"] }) {
  return (
    <header className="border-b border-line bg-card/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href={`/${locale}`} className="text-base font-semibold tracking-tight">
          {nav.brand}
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            href={`/${locale}/analyze`}
            className="hidden rounded-md px-3 py-1.5 font-medium text-subtle hover:bg-soft hover:text-foreground sm:block"
          >
            {nav.analyze}
          </Link>
          {/* Reads the session cookie, so it streams in after the static header. */}
          <Suspense fallback={null}>
            <UserNav locale={locale} nav={nav} />
          </Suspense>
          {/* The current path is request data on dynamic routes; until it streams in, link to the other locale's home. */}
          <Suspense fallback={<LanguageSwitcherLink locale={locale} label={nav.switchTo} href={null} />}>
            <LanguageSwitcher locale={locale} label={nav.switchTo} />
          </Suspense>
        </nav>
      </div>
    </header>
  );
}
