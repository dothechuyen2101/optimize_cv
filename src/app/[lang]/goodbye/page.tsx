import Link from "next/link";
import { getDictionary, getLocale } from "@/i18n/get-dictionary";

export default async function GoodbyePage() {
  const locale = await getLocale();
  const { goodbye } = await getDictionary();

  return (
    <div className="mx-auto grid max-w-xl gap-4 px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-semibold">{goodbye.title}</h1>
      <p className="text-subtle">{goodbye.body}</p>
      <Link
        href={`/${locale}`}
        className="justify-self-center rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90"
      >
        {goodbye.home}
      </Link>
    </div>
  );
}
