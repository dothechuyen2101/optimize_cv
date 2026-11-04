import Link from "next/link";
import { Suspense } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { LogoMark } from "./icons";
import { LanguageSwitcher, LanguageSwitcherLink } from "./language-switcher";
import { NAV_LINK, UserNav } from "./user-nav";

export function SiteHeader({ locale, nav }: { locale: Locale; nav: Dictionary["nav"] }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link href={`/${locale}`} aria-label={nav.brand} className="flex items-center gap-2.5 text-base font-semibold tracking-tight">
          <LogoMark />
          <span className="hidden min-[360px]:inline">{nav.brand}</span>
        </Link>
        <nav className="flex items-center gap-0.5 text-sm sm:gap-1">
          <Link href={`/${locale}/analyze`} className={`hidden sm:block ${NAV_LINK}`}>
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
