import { Suspense } from "react";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import { AuthForm, type AuthMode } from "./auth-form";

export async function AuthPage({ mode }: { mode: AuthMode }) {
  const locale = await getLocale();
  const { auth } = await getDictionary();

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">{auth[mode].title}</h1>
      <p className="mt-2 text-sm text-subtle">{auth[mode].subtitle}</p>
      <div className="mt-8 rounded-xl border border-line bg-card p-6">
        {/* The form reads ?next= and ?error=, which are request data. */}
        <Suspense fallback={<div className="h-64" />}>
          <AuthForm mode={mode} locale={locale} dict={auth} />
        </Suspense>
      </div>
    </div>
  );
}
