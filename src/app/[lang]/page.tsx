import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { ScoreRing } from "@/components/analyze/score-ring";
import {
  ArrowRightIcon,
  BriefcaseIcon,
  CheckIcon,
  FileTextIcon,
  GlobeIcon,
  LockIcon,
  MicIcon,
  ShieldCheckIcon,
  SparkleIcon,
  TargetIcon,
  UploadIcon,
} from "@/components/icons";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";
import type { Dictionary } from "@/i18n/types";

type Home = Dictionary["home"];

const FEATURES = [
  { key: "tailor", Icon: FileTextIcon, isNew: false },
  { key: "role", Icon: TargetIcon, isNew: false },
  { key: "interview", Icon: MicIcon, isNew: true },
  { key: "portfolio", Icon: BriefcaseIcon, isNew: false },
] as const;
const STEP_ICONS = [UploadIcon, SparkleIcon, CheckIcon];
const PRINCIPLE_ICONS = [ShieldCheckIcon, LockIcon, GlobeIcon];

// The home page is the one page in both languages worth indexing; hreflang ties the two together.
export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    alternates: { canonical: `/${locale}`, languages: { vi: "/vi", en: "/en", "x-default": "/vi" } },
  };
}

/** Staggers the entrance animation of sibling blocks. */
const delay = (ms: number): CSSProperties => ({ animationDelay: `${ms}ms` });

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-4 text-lg text-subtle text-pretty">{subtitle}</p>}
    </div>
  );
}

function Chip({ children, tone }: { children: ReactNode; tone: "success" | "danger" }) {
  const style = tone === "success" ? "bg-success-soft text-success" : "bg-danger-soft text-danger";
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>{children}</span>;
}

/** A static picture of an analysis result: what a user gets, without leaving the page. */
function ProductPreview({ preview }: { preview: Home["preview"] }) {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden="true">
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-linear-to-tr from-primary/25 via-accent/20 to-sky-400/20 blur-2xl" />
      <div className="rounded-2xl border border-line bg-card/90 p-5 shadow-2xl shadow-primary/10 backdrop-blur sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold">{preview.job}</p>
          <span className="shrink-0 rounded-full bg-soft px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-primary">{preview.market}</span>
        </div>
        <div className="mt-5 flex items-center gap-5">
          <ScoreRing score={82} label={preview.score} />
          <dl className="grid flex-1 gap-3">
            {preview.bars.map((bar) => (
              <div key={bar.label} className="grid gap-1">
                <dt className="flex justify-between text-xs text-subtle">
                  {bar.label}
                  <span className="tabular-nums">{bar.value}</span>
                </dt>
                <dd className="h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-linear-to-r from-primary to-accent" style={{ width: `${bar.value}%` }} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-5 grid gap-2 rounded-xl border border-line bg-background/60 p-4 text-sm">
          <p className="text-xs font-semibold tracking-wide text-primary uppercase">{preview.suggestion}</p>
          <p className="text-subtle line-through decoration-line">{preview.before}</p>
          <p className="rounded-lg bg-soft px-3 py-2 font-medium leading-relaxed">{preview.after}</p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-subtle">{preview.added}:</span>
            {preview.addedItems.map((item) => (
              <Chip key={item} tone="success">
                {item}
              </Chip>
            ))}
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-subtle">{preview.missing}:</span>
          {preview.missingItems.map((item) => (
            <Chip key={item} tone="danger">
              {item}
            </Chip>
          ))}
        </div>
      </div>
      <div className="absolute -top-4 -right-2 animate-float rounded-xl border border-line bg-card px-3 py-2 text-sm font-semibold text-success shadow-lg sm:-right-6">
        {preview.gain}
      </div>
    </div>
  );
}

export default async function HomePage() {
  const locale = await getLocale();
  const { home } = await getDictionary();
  const analyzeHref = `/${locale}/analyze`;

  return (
    <div className="relative isolate overflow-hidden">
      {/* Soft brand glow and a faint grid behind the hero. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[46rem]">
        <div className="absolute top-[-12rem] left-1/2 h-[34rem] w-[64rem] -translate-x-1/2 rounded-full bg-linear-to-r from-primary/25 via-accent/20 to-sky-400/20 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,var(--line)_1px,transparent_1px),linear-gradient(to_bottom,var(--line)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top,black_20%,transparent_70%)] [background-size:56px_56px] opacity-50" />
      </div>

      <section className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-16 pb-20 sm:px-6 sm:pt-24 lg:grid-cols-[1.05fr_1fr] lg:pb-28">
        <div>
          <p className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-line bg-card/70 px-3 py-1 text-sm font-medium text-primary shadow-sm backdrop-blur">
            <span className="size-1.5 rounded-full bg-primary" />
            {home.eyebrow}
          </p>
          <h1
            className="mt-5 animate-fade-up text-4xl font-semibold tracking-tight text-balance sm:text-5xl sm:leading-[1.08]"
            style={delay(80)}
          >
            {home.titleLead}{" "}
            <span className="bg-linear-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              {home.titleAccent}
            </span>
          </h1>
          <p className="mt-6 max-w-xl animate-fade-up text-lg leading-relaxed text-subtle text-pretty" style={delay(160)}>
            {home.subtitle}
          </p>
          <div className="mt-8 grid animate-fade-up gap-3 text-center sm:flex sm:flex-wrap sm:items-center" style={delay(240)}>
            <Link
              href={analyzeHref}
              className="group inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg shadow-lg shadow-primary/25 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/30"
            >
              {home.cta}
              <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how"
              className="rounded-xl border border-line bg-card/70 px-5 py-3 text-sm font-semibold backdrop-blur hover:border-primary/40 hover:bg-card"
            >
              {home.secondaryCta}
            </a>
          </div>
          <ul className="mt-7 flex animate-fade-up flex-wrap gap-x-5 gap-y-2 text-sm text-subtle" style={delay(320)}>
            {home.trust.map((item) => (
              <li key={item} className="flex items-center gap-1.5">
                <CheckIcon className="size-4 text-success" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-3 animate-fade-up text-xs text-subtle" style={delay(360)}>
            {home.ctaNote}
          </p>
        </div>
        <div className="animate-fade-up" style={delay(200)}>
          <ProductPreview preview={home.preview} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading title={home.featuresTitle} subtitle={home.featuresSubtitle} />
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ key, Icon, isNew }) => (
            <div
              key={key}
              className="group relative rounded-2xl border border-line bg-card p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-xl bg-linear-to-br from-primary/15 to-accent/15 text-primary">
                  <Icon className="size-5" />
                </span>
                {isNew && (
                  <span className="rounded-full bg-linear-to-r from-indigo-600 to-violet-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                    {home.newBadge}
                  </span>
                )}
              </div>
              <h3 className="mt-5 font-semibold">{home.features[key].title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-subtle">{home.features[key].body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how" className="scroll-mt-20 border-y border-line/70 bg-card/50">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <SectionHeading title={home.howTitle} />
          <div className="relative mt-12">
            <div aria-hidden="true" className="absolute top-6 right-[16%] left-[16%] hidden h-px bg-linear-to-r from-transparent via-line to-transparent md:block" />
            <ol className="relative grid gap-8 md:grid-cols-3">
              {home.steps.map((step, i) => {
                const Icon = STEP_ICONS[i];
                return (
                  <li key={step.title} className="relative text-center">
                    <span className="relative mx-auto flex size-12 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-primary/25">
                      <Icon className="size-5" />
                      <span className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full border border-line bg-card text-xs font-semibold text-foreground">
                        {i + 1}
                      </span>
                    </span>
                    <h3 className="mt-5 font-semibold">{step.title}</h3>
                    <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-subtle">{step.body}</p>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <SectionHeading title={home.principlesTitle} />
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {home.principles.map((principle, i) => {
            const Icon = PRINCIPLE_ICONS[i];
            return (
              <div key={principle.title} className="flex gap-4 rounded-2xl border border-line bg-card p-6 shadow-sm">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success">
                  <Icon className="size-5" />
                </span>
                <div>
                  <h3 className="font-semibold">{principle.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-subtle">{principle.body}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="relative isolate overflow-hidden rounded-3xl bg-linear-to-br from-indigo-600 to-violet-600 px-6 py-14 text-center text-white shadow-2xl shadow-primary/25 sm:px-12">
          <div aria-hidden="true" className="absolute -top-24 -right-24 -z-10 size-72 rounded-full bg-white/15 blur-3xl" />
          <div aria-hidden="true" className="absolute -bottom-24 -left-24 -z-10 size-72 rounded-full bg-white/10 blur-3xl" />
          <h2 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{home.finalTitle}</h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-white/85">{home.finalBody}</p>
          <Link
            href={analyzeHref}
            className="group mt-8 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-indigo-700 shadow-lg hover:-translate-y-0.5 hover:shadow-xl"
          >
            {home.finalCta}
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
