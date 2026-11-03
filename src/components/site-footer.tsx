import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { LogoMark } from "./icons";

export function SiteFooter({ locale, nav, footer }: { locale: Locale; nav: Dictionary["nav"]; footer: Dictionary["footer"] }) {
  return (
    <footer className="border-t border-line/70">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-subtle sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-2.5">
          <LogoMark className="size-6" />
          <span>
            <span className="font-semibold text-foreground">{nav.brand}</span> · {footer.tagline}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <Link href={`/${locale}/analyze`} className="hover:text-foreground">
            {nav.analyze}
          </Link>
          <span>{footer.rights}</span>
        </div>
      </div>
    </footer>
  );
}
