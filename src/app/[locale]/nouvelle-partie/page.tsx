import { hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";

import { SetupFlow } from "@/components/setup/review-start";
import { routing } from "@/i18n/routing";
import { getFrenchLocaleStaticParams } from "@/i18n/static-params";

type NouvellePartiePageProps = Readonly<{
  params: Promise<{ locale: string }>;
}>;

export function generateStaticParams() {
  return getFrenchLocaleStaticParams();
}

export default async function NouvellePartiePage({ params }: NouvellePartiePageProps) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale) || locale !== "fr") {
    notFound();
  }

  setRequestLocale(locale);

  return <SetupFlow locale={locale} />;
}
