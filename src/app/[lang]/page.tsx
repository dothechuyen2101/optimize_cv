import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";

const FEATURES = [
  { key: "tailor", available: true },
  { key: "role", available: false },
  { key: "portfolio", available: false },
  { key: "interview", available: false },
] as const;

export default async function HomePage() {
  const locale = await getLocale();
  const { home } = await getDictionary();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
      <section className="max-w-3xl">
        <p className="text-sm font-medium text-primary">{home.eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-balance sm:text-5xl">{home.title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-subtle text-pretty">{home.subtitle}</p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href={`/${locale}/analyze`}
            className="rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-fg shadow-sm hover:opacity-90"
          >
            {home.cta}
          </Link>
          <span className="text-sm text-subtle">{home.ctaNote}</span>
        </div>
      </section>

      <section className="mt-20 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map(({ key, available }) => (
          <div key={key} className="rounded-xl border border-line bg-card p-5">
            <span
              className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                available ? "bg-success-soft text-success" : "bg-soft text-subtle"
              }`}
            >
              {available ? home.available : home.comingSoon}
            </span>
            <h2 className="mt-4 font-semibold">{home.features[key].title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-subtle">{home.features[key].body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
