import { lang } from "next/root-params";
import { notFound } from "next/navigation";
import { hasLocale, type Locale } from "./config";
import type { Dictionary } from "./types";

const dictionaries: Record<Locale, () => Promise<Dictionary>> = {
  vi: () => import("./dictionaries/vi.json").then((module) => module.default),
  en: () => import("./dictionaries/en.json").then((module) => module.default),
};

export async function getLocale(): Promise<Locale> {
  const locale = await lang();
  if (!hasLocale(locale)) notFound();
  return locale;
}

export async function getDictionary(): Promise<Dictionary> {
  return dictionaries[await getLocale()]();
}

/** For code that gets the locale as a param instead of from the route, like metadata images. */
export function dictionaryFor(locale: Locale): Promise<Dictionary> {
  return dictionaries[locale]();
}
