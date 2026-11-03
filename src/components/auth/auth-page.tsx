import Link from "next/link";
import { Suspense } from "react";
import { LogoMark } from "@/components/icons";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AuthForm, type AuthMode } from "./auth-form";

export async function AuthPage({ mode }: { mode: AuthMode }) {
  const locale = await getLocale();
  const { auth, nav } = await getDictionary();

  return (
    <div className="relative isolate overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-10rem] left-1/2 -z-10 h-[28rem] w-[48rem] -translate-x-1/2 rounded-full bg-linear-to-r from-primary/20 via-accent/15 to-sky-400/15 blur-3xl"
      />
      <div className="mx-auto max-w-md animate-fade-up px-4 py-16 sm:px-6">
        <Link href={`/${locale}`} className="mx-auto flex w-fit items-center gap-2.5 font-semibold tracking-tight">
          <LogoMark className="size-9" />
          <span className="text-lg">{nav.brand}</span>
        </Link>
        <div className="mt-8 rounded-2xl border border-line bg-card/90 p-6 shadow-xl shadow-primary/5 backdrop-blur sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">{auth[mode].title}</h1>
          <p className="mt-2 text-sm text-subtle">{auth[mode].subtitle}</p>
          <div className="mt-6">
            {/* The form reads ?next= and ?error=, which are request data. */}
            <Suspense fallback={<div className="h-64" />}>
              <AuthForm mode={mode} locale={locale} dict={auth} />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
