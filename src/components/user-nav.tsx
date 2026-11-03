import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { signOut } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";

export const NAV_LINK = "rounded-lg px-3 py-2 font-medium text-subtle hover:bg-soft hover:text-foreground";

export async function UserNav({ locale, nav }: { locale: Locale; nav: Dictionary["nav"] }) {
  const user = await getSessionUser();

  if (!user) {
    return (
      <>
        <Link href={`/${locale}/login`} className={NAV_LINK}>
          {nav.login}
        </Link>
        <Link
          href={`/${locale}/signup`}
          className="hidden rounded-lg bg-primary px-3.5 py-2 font-semibold text-primary-fg shadow-sm shadow-primary/25 hover:opacity-90 sm:block"
        >
          {nav.getStarted}
        </Link>
      </>
    );
  }

  return (
    <>
      <Link href={`/${locale}/history`} className={NAV_LINK}>
        {nav.history}
      </Link>
      {/* On phones these two live on the account page, so the header fits. */}
      <Link href={`/${locale}/interviews`} className={`hidden sm:block ${NAV_LINK}`}>
        {nav.interviews}
      </Link>
      <Link href={`/${locale}/account`} className={NAV_LINK}>
        {nav.account}
      </Link>
      <form action={signOut} className="hidden sm:block">
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" title={user.email ?? undefined} className={NAV_LINK}>
          {nav.logout}
        </button>
      </form>
    </>
  );
}
