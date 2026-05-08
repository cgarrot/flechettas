import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { SetupFlow } from "@/components/setup/review-start";
import { routing } from "@/i18n/routing";
import { getEnglishLocaleStaticParams } from "@/i18n/static-params";

type NewGamePageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return getEnglishLocaleStaticParams();
}

export default async function NewGamePage({ params }: NewGamePageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale) || locale !== "en") {
    notFound();
  }

  setRequestLocale(locale);

  return <SetupFlow locale={locale} />;
}
