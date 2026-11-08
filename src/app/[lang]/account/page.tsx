import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { DeleteAccountForm } from "@/components/account/delete-account-form";
import { format, type Locale } from "@/i18n/config";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import type { Dictionary } from "@/i18n/types";
import { accountOverview } from "@/lib/account/service";
import { signOut } from "@/lib/auth/actions";
import { getSessionUser } from "@/lib/auth/session";

function Card({ title, children, danger = false }: { title: string; children: ReactNode; danger?: boolean }) {
  return (
    <section className={`grid gap-3 rounded-xl border bg-card p-5 sm:p-6 ${danger ? "border-danger" : "border-line"}`}>
      <h2 className={`text-lg font-semibold ${danger ? "text-danger" : ""}`}>{title}</h2>
      {children}
    </section>
  );
}

async function Account({ locale, dict, nav }: { locale: Locale; dict: Dictionary["account"]; nav: Dictionary["nav"] }) {
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=/${locale}/account`);
  const { plan, quota, usage } = await accountOverview(user.id);
  const link = "rounded-lg border border-line bg-card px-4 py-2 text-sm font-medium hover:bg-soft";

  return (
    <div className="mt-6 grid gap-6">
      <Card title={dict.usageTitle}>
        <p className="text-sm">
          {dict.plan}: <span className="font-semibold">{dict.plans[plan]}</span>
        </p>
        <p className="text-sm">
          {dict.quota}:{" "}
          <span className="font-semibold tabular-nums">
            {quota.limit === null ? dict.unlimited : format(dict.used, { used: quota.used, limit: quota.limit })}
          </span>
        </p>
        <dl className="grid gap-2 sm:grid-cols-3">
          {(["analysis", "interview", "portfolio"] as const).map((key) => (
            <div key={key} className="rounded-lg bg-soft px-3 py-2 text-sm">
              <dt className="text-subtle">{dict.usage[key]}</dt>
              <dd className="mt-0.5 font-semibold tabular-nums">{usage[key]}</dd>
            </div>
          ))}
        </dl>
        <p className="text-xs text-subtle">
          {quota.limit !== null && `${format(dict.usageShared, { limit: quota.limit })} `}
          {dict.usageNote}
        </p>
      </Card>

      <Card title={dict.shortcuts}>
        <div className="flex flex-wrap gap-2">
          <Link href={`/${locale}/history`} className={link}>
            {nav.history}
          </Link>
          <Link href={`/${locale}/interviews`} className={link}>
            {nav.interviews}
          </Link>
          <form action={signOut}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className={link}>
              {dict.signOut}
            </button>
          </form>
        </div>
      </Card>

      <Card title={dict.dataTitle}>
        <p className="text-sm text-subtle">{dict.dataBody}</p>
        <a href="/api/account/export" download className={`justify-self-start ${link}`}>
          {dict.export}
        </a>
      </Card>

      <Card title={dict.deleteTitle} danger>
        <p className="text-sm text-subtle">{dict.deleteBody}</p>
        {user.email && <DeleteAccountForm locale={locale} email={user.email} dict={dict} />}
      </Card>
    </div>
  );
}

export default async function AccountPage() {
  const locale = await getLocale();
  const { account, nav } = await getDictionary();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">{account.title}</h1>
      <Suspense fallback={<div className="mt-6 h-72 rounded-xl border border-line bg-card" />}>
        <Account locale={locale} dict={account} nav={nav} />
      </Suspense>
    </div>
  );
}
