import Link from "next/link";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { signOut } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";

const LINK = "rounded-md px-3 py-1.5 font-medium text-subtle hover:bg-soft hover:text-foreground";

export async function UserNav({ locale, nav }: { locale: Locale; nav: Dictionary["nav"] }) {
  const user = await getSessionUser();

  if (!user) {
    return (
      <Link href={`/${locale}/login`} className={LINK}>
        {nav.login}
      </Link>
    );
  }

  return (
    <>
      <Link href={`/${locale}/history`} className={LINK}>
        {nav.history}
      </Link>
      <Link href={`/${locale}/interviews`} className={LINK}>
        {nav.interviews}
      </Link>
      <form action={signOut}>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" title={user.email ?? undefined} className={LINK}>
          {nav.logout}
        </button>
      </form>
    </>
  );
}
